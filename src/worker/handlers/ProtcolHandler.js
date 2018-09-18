const waterfall = require('async/waterfall');
const parallel = require('async/parallel');
const PeerId = require('peer-id');
const PeerInfo = require('peer-info');
const pull = require('pull-stream');
const Policy = require('../../policy/policy');
const nodeUtils = require('../../common/utils');
const EventEmitter = require('events').EventEmitter;
const constants = require('../../common/constants');
const PROTOCOLS = constants.PROTOCOLS;
const STATUS = constants.MSG_STATUS;
const NOTIFICATION = constants.NODE_NOTIFICATIONS;
const Messages = require('../../policy/messages');
const PeerBank = require('./PeerBank');

class ProtocolHandler extends EventEmitter{
    constructor(){
        super();
        this._protocols = [
            PROTOCOLS['ECHO'],PROTOCOLS['HANDSHAKE'],
            PROTOCOLS['PEERS_PEER_BOOK'],PROTOCOLS['HEARTBEAT'],
            PROTOCOLS['GROUP_DIAL'], PROTOCOLS['FIND_PEERS']];

        //this._state = state;
        this.fallback = this.tempFallback;
        this.policy = new Policy();
        this.handlers = {};
        this.handlers[PROTOCOLS['PEER_DISCOVERY']] = this.onPeerDiscovery;
        this.handlers[PROTOCOLS['PEER_CONNECT']] = this.onPeerConnect;
        this.handlers[PROTOCOLS['PEER_DISCONNECT']] = this.onPeerDisconnect;
        this.handlers[PROTOCOLS['PEERS_PEER_BOOK']] = this.onGetPeerBook;
        this.handlers[PROTOCOLS['GROUP_DIAL']] = this.onGroupDial;
        this.handlers[PROTOCOLS['HANDSHAKE']] = this.onHandshake;
        this.handlers[PROTOCOLS['HEARTBEAT']] = this.onHeartBeat;
        this.handlers[PROTOCOLS['ECHO']] = this.onEcho;
        this.handlers[PROTOCOLS['FIND_PEERS']] = this.onFindPeers;

    }
    getProtocolsList(){
        return this._protocols;
    }
    /**
     * Notify observer (Some controller subscribed)
     * @param {Json} params, MUTS CONTAIN notification field
     * */
    notify(params){
        this.emit('notify',params);
    }
    /** Handle is a dispatching function
     * It is triggerd everytime a EnigmaNode needs to dispatch some dialProtocol
     * TODO:: maybe add more policy in here.
     * TODO:: for example, drop messages incase of DOS attempt
     * */
    handle(protocolName, nodeNundle, params){
        if(!this.policy.isValidProtocol(protocolName)) {
            this.fallback(protocolName, nodeNundle, params);
            return;
        }
        this.handlers[protocolName](nodeNundle,params);
    }

    tempFallback(protocolName){
        console.log('[-] Err invalid protocolName: ' + protocolName);
    }
    /** /findpeers/0.0
     * On a findpeers request msg
     * */
    onFindPeers(nodeBundle,params){
        let selfNode = params.worker;
        let peers = selfNode.getAllPeersInfo();
        pull(
            params.connection,
            pull.map(data=>{
                let findPeersRequestMsg = nodeUtils.toFindPeersReqMsg(data);
                if(!findPeersRequestMsg.isValidMsg()){
                    this.fallback('/findpeers/0.0 invalid findpeer request was sent to local node.');
                    return;
                }

                let maxPeers = findPeersRequestMsg.maxPeers();

                if(Number.isInteger(maxPeers) && maxPeers > 0){
                    // pick random peers as requested
                    peers = nodeUtils.pickRandomFromList(peers,maxPeers);
                }
                let parsed = nodeUtils.parsePeerBook(peers);
                let findPeersResponseMsg = new Messages.FindPeersResMsg({
                    'from':selfNode.getSelfIdB58Str(),
                    'to': findPeersRequestMsg.from(),
                    'peers':parsed,
                    'id' :findPeersRequestMsg.id()
                });
                return findPeersResponseMsg.toNetworkStream();
            }),
            params.connection
        );
    }

    /** /getpeekbook protocol
     * !!! DEPRECATED !!
     * response with workers peer book
     * @param {PeerBundle} , nodeBundle libp2p bundle
     * @param {Json} params, {connection, worker,peer,protocol}
     * TODO:: Replace with a strongly typed "Message" class as a response.
     * */
    onGetPeerBook(nodeBundle, params){
        let selfNode = params.worker;
        let peers = selfNode.getAllPeersInfo();
        let parsed = nodeUtils.parsePeerBook(peers);
        // stream back the connection
        pull(
            pull.values([JSON.stringify({
                "from" : selfNode.getSelfPeerInfo().id.toJSON(),
                "peers" : parsed})]),
            params.connection
        );
    }
    /** This is NOT a connection establishment.
     * This simply means that a given boostrap node string has turned into a PeerInfo
     * and now the worker can dial to the peer.
     * A connection is not made before actually dialing.
     * @param {PeerBundle} , nodeBundle libp2p bundle
     * @param {Json} params, {connection, worker,peer,protocol}
     * */
    onPeerDiscovery(nodeBundle, params){
        // incase a dns node "discoverd" himself
        if(params.worker.getSelfIdB58Str() == params.peer.id.toB58String()){
            return;
        }
        // if currently not connected to discoverd peer
        if(!params.worker.isConnected(params.peer.id.toB58String())){
            params.worker.getProtocolHandler().notify({'notification':NOTIFICATION['DISCOVERED'], 'params' : params});
        }
    }
    /** handle when all bootstrap nodes returned peers.
     * */
    /** Temporary for testing purposes.
     * Takes a msg and responds with echo.
     * kind of an "interactive ping"
     **/
    onEcho(nodeBundle,params){
        pull(params.connection, params.connection);
    }
    /**This event is triggerd upon a handshake request
     * Meaning, a ping message is attached
     * Should check if findpeers is True and attach peer list
     * Compose a PongMsg and send back
     * TODO:: Should validate if connection is desired or not.
     * TODO:: Place it somewhere smart.
     * @param {PeerBundle} , nodeBundle libp2p bundle
     * @param {Json} params, {connection, worker,peer,protocol}
     * */
    onHandshake(nodeBundle,params){

        let conn = params.connection;
        let worker = params.worker;
        pull(
            conn,
            pull.map((data) => {
                let pingMsg = nodeUtils.toPingMsg(data);
                if(pingMsg.isValidMsg()){
                    // create pong msg
                    let parsed = [];
                    if(pingMsg.findPeers()){
                        let seeds = worker.getAllPeersInfo();
                        parsed = nodeUtils.parsePeerBook(seeds);
                    }
                    let pong = new Messages.PongMsg({
                        "id" : pingMsg.id(),
                        "from":worker.getSelfIdB58Str(),
                        "to":pingMsg.from(),
                        "status":STATUS['OK'],
                        "seeds":parsed});
                    // notify
                    //TODO:: Below commented code
                    //TODO:: Need to notify BUT to change and define this is !!!inbound connection!!!
                    conn.getPeerInfo((err,peerInfo)=>{
                        if(err){
                            console.log('[-] err retrieving peer info from connection on handshake ', err);
                            return;
                        }
                        worker.getProtocolHandler().notify({
                            'notification' : NOTIFICATION.HANDSHAKE_UPDATE,
                            'status' : pong.status(),
                            'pong' : pong,
                            'who' : peerInfo,
                        });
                    });
                    // validate correctness
                    if(pong.isValidMsg()){
                        return pong.toNetworkStream();
                    }
                }else{
                    // TODO:: return err and drop connection
                    return null;
                }
            }),
            conn
        );
    }
    /** Response to a heart-beat request.
     *@param {PeerBundle} nodeBundle , the libp2p bundle
     *@param {Json} params , {worker,connection,peer,protocol}
     **/
    onHeartBeat(noBundle,params){
        pull(
            params.connection,
            pull.map(data=>{
                let hbReq = nodeUtils.toHeartBeatReqMsg(data);
                if(!hbReq.isValidMsg()){
                    //TODO:: Add log
                    //TODO:: Handle error - possibly response with error to peer
                    this.fallback("/heartbeat");
                }else{
                    let hbRes = new Messages.HeartBeatResMsg({
                        "from" : params.worker.getSelfIdB58Str(),
                        "to" : hbReq.from(),
                        "id" : hbReq.id(),
                    });
                    if(!hbRes.isValidMsg()) {
                        // TODO:: Handle error
                        console.log("[-] Err generating a hb res");
                    }
                    return hbRes.toNetworkStream();
                }
            }),
            params.connection
        );
    }
    /** Triggers every time a new connection is established -
     * When a remote peer dialed. (no protocol specification)
     * @param {PeerBundle} nodeBundle , the libp2p bundle
     * @param {Json} params , {worker,connection,peer,protocol}
     * */
    onPeerConnect(nodeBundle,params){
        console.log('[Connection with '+ nodeBundle.peerInfo.id.toB58String()+
            '] new peer : ' + params.peer.id.toB58String());
    }
    /**Group dial is when the worker needs to send a message to all of his peers
     * @param {PeerBundle} nodeBundle, libp2p bundle
     * @param {Json} params , {worker,connection,peer,protocol}
     * TODO:: improve : add the option to pass an array of peers to dial
     * */
    onGroupDial(nodeBundle,params){
        // let connection = params.connection;
        // let selfWorker = params.worker;
        // // handle the message recieved from the dialing peer.
        // console.log(selfWorker.getSelfPeerInfo().id.toB58String() +  ' => got a groupdial');
        // pull(
        //     connection,
        //     connection
        // );
    }
    /**On peer disconnect
     * @param {PeerBundle} nodeBundle, libp2p bundle
     * @param {Json} params , {worker,connection,peer,protocol}
     * TODO:: Every disconnect check if should re-build table and add more peers.
     * */
    onPeerDisconnect(nodeBundle,params){
        console.log("peer disconnected from " + params.peer.id.toB58String());
    }
}

module.exports = ProtocolHandler;
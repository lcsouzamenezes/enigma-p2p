const parallel = require('async/parallel');
const EnigmaNode = require('../../src/worker/EnigmaNode');
const utils = require('../utils');
const assert = require('assert');
const waterfall = require('async/waterfall');
const pull = require('pull-stream');

/**
 * Test Description:
 * The test spawns 2 nodes Dialer and Listener.
 * The test uses the Discovery algorithm of libp2p to help the Dialer find the Listener
 * The Dialer sends a message the Listener then responds.*/

    let portListener = '0';
    let portDialer = '10333';
    let idListener = 'QmcrQZ6RJdpYuGvZqD5QEHAv6qX4BrQLJLQPQUrTrzdcgm';
    let protocols = ['/echo'];
    let pathDialer = '/home/wildermind/WebstormProjects/enigma-p2p/test/id-d';
    let pathListener = '/home/wildermind/WebstormProjects/enigma-p2p/test/id-l';
    let nodeDialer,nodeListener;
    waterfall([
        cb =>{ // the listener node
            nodeListener = utils.buildWorker(portListener,portListener,idListener);
            nodeListener.loadNode(pathListener,()=>{
                nodeListener.start(()=>{
                    nodeListener.addHandlers(protocols,NaiveHandle);
                    setTimeout(cb,100);
                });
            });
        },
        cb =>{
            nodeDialer = utils.buildWorker(portDialer,portListener,idListener);
            nodeDialer.loadNode(pathDialer,()=>{
                setTimeout(cb,100);
            });
        },
    ],(err)=>{
        assert.equal(null,err, "Some error at the end of the waterfall");
        nodeDialer.start(()=>{
            nodeDialer.addHandlers(protocols,NaiveHandle);
            nodeDialer.dialProtocol(nodeListener.node.peerInfo,'/echo',(err,conn)=>{
                assert.equal(null,err, "Some error at Dialer.dialProtocol");
                // send the echo to the listener
                pull(
                    pull.values(['hey']),
                    conn,
                    pull.collect((err,data)=>{
                        assert.equal(null,err, "Some error collection the echo response from the Listener");
                        assert.equal('hey',data.toString());
                        //stop
                        nodeDialer.stop((err)=>{
                            assert.equal(null,err, "Some error while Dialer stopped");
                            nodeListener.stop((err)=>{
                                assert.equal(null,err,"Some error while listener stopped.");

                            });
                        });
                    })
                );
            });
        });
    });









function NaiveHandle(type,peer,params) {
    switch (type) {
        case "peer:discovery":
            utils.NaiveHandlers['peer:discovery'](peer, params.peer);
            break;
        case "peer:connect":
            utils.NaiveHandlers['peer:connect'](peer, params.peer);
            break;
        case "/echo":
            utils.NaiveHandlers['/echo'](params.protocol,params.connection);
            break;
        case "/getpeerbook":
            utils.NaiveHandlers['/getpeerbook'](peer,params);
            break;
        case '/groupdial':
            utils.NaiveHandlers['/groupdial'](peer,params);
            break;
    }
}



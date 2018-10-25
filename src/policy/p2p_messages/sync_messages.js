const constants = require('../../common/constants');
const MSG_TYPES = constants.P2P_MESSAGES;
const schemeValidator = require('./schemes/SchemeValidator');
const nodeUtils = require('../../common/utils');
const EncoderUtil = require('../../common/EncoderUtil');

class SyncMsgBuilder {
    static stateReqFromNetwork(networkMsg, callback){
        let obj = SyncMsgBuilder._parseFromNetwork(networkMsg);
        if(obj){
            SyncMsgBuilder.stateReqFromObj(obj,callback);
        }else{
            callback('error decoded network msg');
        }
    }
    static stateResFromNetwork(networkMsg, callback){
        let obj = SyncMsgBuilder._parseFromNetwork(networkMsg);
        if(obj){
            SyncMsgBuilder.stateResFromObj(obj,callback);
        }else{
            callback('error decoded network msg');
        }
    }
    static _parseFromNetwork(networkMsg){
        let decoded = EncoderUtil.decodeFromNetwork(networkMsg);
        let obj = JSON.parse(decoded);
        return obj;
    }
    static stateReqFromObj(msgObj,callback){
        msgObj.msgType = 'SYNC_STATE_REQ';
        SyncMsgBuilder._buildMsg(MSG_TYPES.SYNC_STATE_REQ, msgObj, (err,message)=>{
            callback(err,message);
        });
    }
    static stateResFromObj(msgObj,callback){
        msgObj.msgType = 'SYNC_STATE_RES';
        SyncMsgBuilder._buildMsg(MSG_TYPES.SYNC_STATE_RES, msgObj, (err,message)=>{
            callback(err,message);
        });
    }
    static bCodeFromNetwork(){}
    static bCodeFromObj(){}
    static _isValidScheme(schemeType,testedObj,callback){
        schemeValidator.validateScheme(testedObj, schemeType,callback);
    }
    static _buildMsg(msgType, msgObj, callback){
        SyncMsgBuilder._isValidScheme(msgType,msgObj,(err,isValid)=>{
            if(err){
                callback(err);
            }else{
                if(isValid){
                    switch(msgType){
                        case MSG_TYPES.SYNC_STATE_REQ:
                            callback(null,new SyncStateReqMsg(msgObj));
                            break;
                        case MSG_TYPES.SYNC_STATE_RES:
                            callback(null,new SyncStateResMsg(msgObj));
                            break;
                    }
                }else{
                    callback('invalid scheme');
                }
            }
        });
    }
}

class SyncMsg {
    constructor(rawMsg){
        this._rawMsg = rawMsg;
    }
    toJSON(){
        return JSON.stringify(this._rawMsg);
    }
    toPrettyJSON(){
        return JSON.stringify(this._rawMsg,null,2);
    }
    toNetwork(){
        let msg = this.toJSON();
        let encoded = EncoderUtil.encodeToNetwork(msg);
        return encoded;
    }
}

class SyncStateReqMsg extends SyncMsg{
    constructor(rawMsg){
        super(rawMsg);
    }
    contractAddress(){
        return this._rawMsg.contractAddress;
    }
    getRange(){
        return {
            fromIndex : this.fromIndex(),
            fromHash : this.fromHash(),
            toIndex: this.toIndex(),
            toHash : this.toHash(),
        };
    }
    fromIndex(){
        return this._rawMsg.fromIndex;
    }
    fromHash(){
        return this._rawMsg.fromHash;
    }
    toHash(){
        return this._rawMsg.toHash;
    }
    toIndex(){
        return this._rawMsg.toIndex;
    }
}


class SyncStateResMsg extends SyncMsg{
    constructor(rawMsg){
        super(rawMsg);
    }
    contractAddress(){
        return this._rawMsg.contractAddress;
    }
    states(){
        return this._rawMsg.states;
    }
    state(index){
        if(index < this.states().length){
            return this.states()[index];
        }
    }
    orderStates(){
        this.states().sort((d1,d2)=>{
            return d1.index - d2.index;
        });
        return this.states();
    }
}

module.exports.SyncStateResMsg = SyncStateResMsg;
module.exports.SyncStateReqMsg = SyncStateReqMsg;
module.exports.SyncMsgBuilder = SyncMsgBuilder;
/** mini tests */
//
// let state_sync_req_obj = {
//     contractAddress : '0x...',
//     fromIndex: 1,
//     toIndex : 101,
//     fromHash : '0x...',
//     toHash : '0x...'
// };
//
// let state_sync_res_obj = {
//     contractAddress : '0x...',
//     states : [{index:4,hash : '0x1',data : [11,12,13]},{index:2,hash : '0x2',data : [311,122,133]},{index:3,hash : '0x3',data : [151,152,143]}]
// };


// SyncMsgBuilder.stateReqFromObj(state_sync_req_obj,(err,msg)=>{
//     // console.log("err req ? " + err);
//     // console.log(" req range : " + JSON.stringify(msg.getRange()));
//     // console.log("raw "  + msg.toPrettyJSON());
//
//     let encoded = msg.toNetwork();
//     console.log("encoded : " + encoded);
//     SyncMsgBuilder.stateReqFromNetwork(encoded,(err,msg2)=>{
//         console.log("raw " + msg2.toPrettyJSON());
//     })
// });



//
//
// SyncMsgBuilder.stateResFromObj(state_sync_res_obj, (err,msg)=>{
//     // console.log("err res ? " + err);
//     // console.log("stats orderd  : " + JSON.stringify(msg.orderStates()));
//     // console.log("raw "  + msg.toPrettyJSON());
//
//     let encoded = msg.toNetwork();
//     console.log("encoded:" + encoded);
//     // SyncMsgBuilder.stateResFromNetwork(encoded, (err, msg2)=>{
//     //     console.log("raw" + msg2.toPrettyJSON());
//     //     msg2.orderStates();
//     //     console.log("raw" + msg2.toPrettyJSON());
//     // });
// });



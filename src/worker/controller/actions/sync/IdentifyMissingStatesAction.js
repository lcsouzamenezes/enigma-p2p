const LocalMissingStateResult = require('../../../state_sync/receiver/LocalMissingStatesResult');
const constants = require('../../../../common/constants');
const NODE_NOTIY = constants.NODE_NOTIFICATIONS;

/**
 * This action is the first step to sync
 * this identifies the missing state the worker needs.
 * - it will use the cache or go directly to core.
 * - get the local tips
 * - get remote tips
 * - parse them into a format class "MissingStatesMap"
 * - and return the result to the caller.
 * */
class IdentifyMissingStatesAction{
  constructor(controller){
    this._controller = controller;
  }
  execute(params){
    let useCache = params.cache;
    let finalCallback = params.onResponse;
    if(useCache){
      this._controller.cache().getAllTips((err,tipsList)=>{
          //TODO:: implement cache logic
          //TODO:: if cache empty still query core since maybe it was deleted or first time
      });
    }else{
      this._controller.execCmd(NODE_NOTIY.GET_ALL_TIPS,{
        cache : useCache,
        onResponse : (err,localTips)=>{
          let msgsMap = IdentifyMissingStatesAction._tempBuildMissingStatesResult();
          return finalCallback(err,msgsMap);
        }
      })
    }
  }
  static _tempBuildMissingStatesResult(){
    // generate fake local tips
    let addr1 = '4cd6ab04431776c3543867c76115e237dc36d4f6aecb33ab1c1e3f9e8340b521'; // 0,1,2
    let addr2 ='0bd6ab04431776c3542267c76115e237dc8fd4f6aecb33ab1c1e3f9e8340b5c8'; // 0
    let addr3 = '0dd6ab04431776c3543867c76115e237dc36d4f6aecb33ab1c1e3f9e8340b52a'; // 0,1
    let mockMissing = [
      {address : addr1, deltas : [{deltaHash : 'hash1_0',index:0},{deltaHash : 'hash1_1',index:1},{deltaHash : 'hash1_2',index:2}]},
      {address : addr2, deltas : [{deltaHash : 'hash2_0',index:0}]},
      {address : addr3, deltas : [{deltaHash : 'hash3_0',index:0},{deltaHash : 'hash3_1',index:1}]},
    ];
    let result = LocalMissingStateResult.createP2PReqMsgsMap(mockMissing);
    let finalOutput = {};
    for(let ecidHash in result){
      let obj = result[ecidHash];
      if(obj.bcodeReq){
        obj.deltasReq.push(obj.bcodeReq);
      }
      finalOutput[ecidHash] = obj.deltasReq;
    }
    return finalOutput;
  }
}
module.exports = IdentifyMissingStatesAction;


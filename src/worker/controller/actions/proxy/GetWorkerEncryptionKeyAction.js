const constants = require('../../../../common/constants');
const STAT_TYPES = constants.STAT_TYPES;
const STATUS = constants.MSG_STATUS;
const Envelop = require('../../../../main_controller/channels/Envelop');

class GetWorkerEncryptionKeyAction{
  constructor(controller){
    this._controller = controller;
  }
  execute(requestEnvelop){

    let workerSignKey = requestEnvelop.content().workerSignKey;
    let sequence = requestEnvelop.content().sequence;
    let selfId = this._controller.engNode().getSelfIdB58Str();
    let targetTopic = selfId + workerSignKey + sequence;
    let request = requestEnvelop.content().request;
    // subscribe to self topic parse response
    this._controller.execCmd(constants.NODE_NOTIFICATIONS.PUBSUB_SUB,
        {
          topic : targetTopic,
          onPublish : (msg)=>{
            let result = {};
            let data = JSON.parse(msg.data);
            result.senderKey = data.senderKey;
            result.workerEncryptionKey = data.workerEncryptionKey;
            result.workerSig = data.workerSig;
            result.msgId = data.msgId;
            let responseEnvelop = new Envelop(requestEnvelop.id(),{
              result : result,
            }, requestEnvelop.type());
            this._controller.communicator().send(responseEnvelop);
          },
          onSubscribed : ()=>{
            console.log('[rpc] temp subscribe to ' + targetTopic);
            // publish the actual request
            this._controller.execCmd(constants.NODE_NOTIFICATIONS.PUBSUB_PUB,{
              topic : workerSignKey,
              message : JSON.stringify({
                request : request,
                sequence : sequence,
                targetTopic : targetTopic,
              }),
            });
          }
    });
  }
}
module.exports = GetWorkerEncryptionKeyAction;

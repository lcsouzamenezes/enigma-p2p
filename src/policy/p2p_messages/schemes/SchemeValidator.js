const loadJsonFile = require('load-json-file');
const constants = require('../../../common/constants');
const MsgTypes = constants.P2P_MESSAGES;
const Validator = require('jsonschema').Validator;

function loadScheme(path, callback){
    loadJsonFile(path).then(json => {
        callback(null,json);
    })
    .catch((err)=>{
            callback(err);
    });
}


const schemeMap = {
    [MsgTypes.STATE_SYNC_REQ] : (testObj,callback)=>{
        loadScheme("./state_sync_scheme.json", (err,preScheme)=>{
            if(err){
                callback(err);
            }else{
                let header = preScheme.header;
                let request = preScheme.request;
                let range = preScheme.range_req;
                let v = new Validator();

                v.addSchema(header, "/StateSyncHeader");
                v.addSchema(range, "/StateSyncRangeReq");

                let isValid = v.validate(testObj,request).valid;

                callback(null,isValid);
            }
        })
    },

    [MsgTypes.STATE_SYNC_RES] : (testObj, callback)=>{
        loadScheme("./state_sync_scheme.json", (err,preScheme)=>{
            //TODO:: implement scheme.
            callback(err,true);
            // if(err){
            //     callback(err);
            // }else{
            //     let header = preScheme.header;
            //     let response = preScheme.response;
            //     let range = preScheme.range;
            //
            //     let v = new Validator();
            //
            //     v.addSchema(header, "/StateSyncHeader");
            //     v.addSchema(range, "/StateSyncRange");
            //
            //     let isValid = v.validate(testObj, response).valid;
            //
            //     callback(null, isValid);
            // }
        });
    },
};

function _validateScheme(testedObj, msgName, callback){
    let s = schemeMap[msgName];
    if(s){
        s(testedObj,callback);
    }else{
        callback("no such scheme");
    }
};

let state_sync_req_obj = {
    "header":{
        "from" : "isan",
        "to" : "elichai"
    },
    "body": {
        "address" : "0x123",
        "range" :{
            "fromIndex" : 1234,
            "toIndex" : 123,
            "fromHash" : "",
            "toHash" : "",
        }
    }
}
_validateScheme(state_sync_req_obj, MsgTypes.STATE_SYNC_REQ ,(err,isValid)=>{
    if(err){
        console.log(err);
    }else{
        console.log("is valid? " + isValid);
    }
});

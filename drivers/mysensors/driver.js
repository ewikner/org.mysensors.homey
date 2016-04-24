var mysensorsProtocol = require('./mysensorsProtocol');
var mqtt = require('mqtt');
var net = require('net');

var gwSplitChar = null;
var devices = {};
var nodes = [];
var gwClient = null
var settings = {};

const FIRMWARE_BLOCK_SIZE = 16;
const BROADCAST_ADDRESS = 255;
const NODE_SENSOR_ID = 255;
var last_node_id = 0;

// Export capabilities
module.exports.capabilities = {}

module.exports.init = function (devices, callback) {
    Homey.log('init');

    settings.gatewayType = Homey.manager('settings').get('gatewayType');
    settings.host = Homey.manager('settings').get('host');
    settings.port = Homey.manager('settings').get('port');
    settings.publish_topic = Homey.manager('settings').get('publish_topic');
    settings.subscribe_topic = Homey.manager('settings').get('subscribe_topic');
    settings.timeout = Homey.manager('settings').get('timeout');

    connectToGateway(settings, function(err) {
        Homey.log(err);
    })
    callback()
}

// Pairing functionality
module.exports.pair = function (socket) {
  socket.on('start', function( data, callback ){
    Homey.log('pair start');

})

socket.on('list_devices', function( data, callback ) {
    Homey.log('pair list_devices');

})

socket.on('add_devices', function( device, callback ) {
    Homey.log('pair add_device');
})
}

module.exports.deleted = function (device_data) {
    // TODO
}

// A user has updated settings, update the device object
module.exports.settings = function (device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback) {
  // TODO
  Homey.log('settings');
  callback(null, true)
}

function handleMessage(message) {
    Homey.log('----- handleMessage -------')
    Homey.log(message)
    switch(message.messageType) {
        case 'presentation': handlePresentation(message); break;
        case 'set': handleSet(message); break;
        case 'req': handleReq(message); break;
        case 'internal': handleInternal(message); break;
        case 'stream': handleStream(message); break;
    }
}

function handlePresentation(message) {
    Homey.log('----- presentation -------')
    var node = getNodeById(message.nodeId);
    var sensors = getSensorInNode(message);
    Homey.log(node);
}

function handleSet(message) {
    Homey.log('----- set -------')
    var node = getNodeById(message.nodeId);
    var sensor = getSensorInNode(message);

    sensor.payload = message.payload;
    sensor.payloadType = message.subType;
    sensor.time = Date.now();
    Homey.log(node);
}

function handleReq(message) {
    Homey.log('----- req -------')
}

function handleInternal(message) {
    Homey.log('----- internal -------')
    Homey.log('subType: '+message.subType)
    switch(message.subType) {
        case 'I_BATTERY_LEVEL': 
            // BATTERY
            var node = getNodeById(message.nodeId);
            node.batteryLevel = message.payload;
            break;
        case 'I_TIME':
            sendData({
                nodeId: message.nodeId,
                sensorId: message.sensorId,
                messageType: message.messageType,
                ack: 0,
                subType: message.subType,
                payload: new Date().getTime()/1000
            });
            break;
        case 'I_VERSION': break;
        case 'I_ID_REQUEST': 
            getNextID(message);
            break;
        case 'I_ID_RESPONSE': break;
        case 'I_INCLUSION_MODE': break;
        case 'I_CONFIG': 
            sendData({
                nodeId: message.nodeId,
                sensorId: NODE_SENSOR_ID,
                messageType: message.messageType,
                ack: 0,
                subType: message.subType,
                payload: 'M'
            });
            break;
        case 'I_FIND_PARENT': break;
        case 'I_FIND_PARENT_RESPONSE': break;
        case 'I_LOG_MESSAGE': break;
        case 'I_CHILDREN': break;
        case 'I_SKETCH_NAME': 
            var node = getNodeById(message.nodeId);
            if(node.sketchName !== message.payload) {
                node.sketchName = message.payload;
            }
            break;
        case 'I_SKETCH_VERSION': 
            var node = getNodeById(message.nodeId);
            if(node.sketchVersion !== message.payload) {
                node.sketchVersion = message.payload;
            }
            break;
        case 'I_REBOOT': break;
        case 'I_GATEWAY_READY': break;
        case 'I_REQUEST_SIGNING': break;
        case 'I_GET_NONCE': break;
        case 'I_GET_NONCE_RESPONSE': break;
        case 'I_HEARTBEAT': break;
        case 'I_PRESENTATION': break;
        case 'I_DISCOVER': break;
        case 'I_DISCOVER_RESPONSE': break;
        case 'I_HEARTBEAT_RESPONSE': break;
        case 'I_LOCKED': break;
    }
}

function handleStream(message) {
    Homey.log('----- stream -------')
}

function sendData(messageObj) {
    Homey.log('-- SEND DATA ----');
    var dataStr = mysensorsProtocol.encodeMessage(messageObj, gwSplitChar);
    Homey.log(dataStr);

    if(settings.gatewayType == 'mqtt') {
        Homey.log("SENDDATA to MQTT "+settings.publish_topic+'/'+dataStr);
    } else if(settings.gatewayType == 'ethernet') {
        Homey.log("SENDDATA to ethernet "+dataStr);
    }
}

function getNextID(message) {
    Homey.log('-- getNextID ----');
    if(last_node_id <= NODE_SENSOR_ID-1) {
        last_node_id++;

    }
    sendData({
        nodeId: message.nodeId,
        sensorId: message.sensorId,
        messageType: message.messageType,
        ack: 0,
        subType: message.subType,
        payload: last_node_id
    });
}

function getNodeById(nodeId) {
    Homey.log("--- getNodeById ----")

    var node = null;
    nodes.forEach(function(item) {
        if(item.nodeId == nodeId) {
            node = item;
        }
    })

    if(node == null) {
        if(last_node_id < nodeId) {
            last_node_id = nodeId;
        }
        Homey.log("--- NEW NODE ----")
        var node = {
            nodeId: nodeId,
            batteryLevel: '',
            sketchName: '',
            sketchVersion: '',
            sensors: []
        };
        nodes.push(node);
    }
    
    return node;
}

function getSensorInNode(message) {
    var node = getNodeById(message.nodeId);
    var sensor = null;
    node.sensors.forEach(function(item) {
        if(item.sensorId == message.sensorId) {
            sensor = item;
        }
    })

    if(sensor == null) {
        Homey.log("--- NEW SENSOR ----")
        var sensor = {
            sensorId: message.sensorId,
            sensorType: message.subType,
            payload: '',
            payloadType: '',
            time: ''
        };
        node.sensors.push(sensor);
    }
    return sensor;
}

function connectToGateway(settings, callback) {
    if(settings.gatewayType == 'mqtt') {
        gwSplitChar = '/';
        Homey.log("----MQTT-----")
        topicPublish = settings.publish_topic;
        topicSubscribe = settings.subscribe_topic;

        gwClient = mqtt.connect('mqtt://'+settings.host+':'+settings.port);
 
        gwClient.on('connect', function () {
          gwClient.subscribe(topicPublish + '/#');
          gwClient.subscribe(topicSubscribe + '/#');

          callback('connected');
        }).on('message', function (topic, data) {
            var dataTopic = topic.substr(topic.indexOf('/')+1);
            var mqttTopic = topic.substr(0,topic.indexOf('/'));
            switch(mqttTopic) {
                case topicPublish:
                    Homey.log('publish');
                    break;
                case topicSubscribe:
                    Homey.log('subscribe');
                    break;
            }
            
            Homey.log(topic + ' : '+ data);
            handleMessage(mysensorsProtocol.decodeMessage(dataTopic+'/'+data, gwSplitChar))
        }).on('close', function () {
            Homey.log('Disconnected');
        }).on('error', function (error) {
            Homey.log('MQTT error');
        });

    } else if(settings.gatewayType == 'ethernet') {
        Homey.log("----Ethernet-----")
        gwSplitChar = ';';
        client = net.Socket();
        gwClient.connect(settings.port, settings.host);

        gwClient.setEncoding('ascii');
        gwClient.setTimeout(settings.timeout);
        gwClient.on('connect', function() {
            Homey.log('IS connected');
            callback('connected');
        }).on('data', function(data) {
            handleMessage(mysensorsProtocol.decodeMessage(data, gwSplitChar))
        }).on('end', function() {
            Homey.log('Disconnected');

        }).on('error', function() {
            Homey.log('Ethernet error');
        });
    } else {
        Homey.log("----TEST-----")
        gwSplitChar = ';';
        var testDataArr = [];
        testDataArr.push("0;0;3;0;9;Starting gateway (RNNGA-, 1.6.0-beta)");
        testDataArr.push("6;0;0;0;7;");
        testDataArr.push("6;1;0;0;6;");
        testDataArr.push("6;2;0;0;1;");
        testDataArr.push("6;199;0;0;38;");
        testDataArr.push("6;1;1;0;0;20.6");
        testDataArr.push("6;199;1;0;38;6.13");
        testDataArr.push("6;199;1;0;38;1.1");

        testDataArr.forEach(function(data) {
            handleMessage(mysensorsProtocol.decodeMessage(data, gwSplitChar))
        });
    }
}
var mysensorsProtocol = require('./mysensorsProtocol');
var mqtt = require('mqtt');
var net = require('net');

var gwSplitChar = null;
var nodes = [];
var gwClient = null
var settings = {};

const FIRMWARE_BLOCK_SIZE = 16;
const BROADCAST_ADDRESS = 255;
const NODE_SENSOR_ID = 255;
var last_node_id = 0;

// Export capabilities
module.exports.capabilities = {}

Homey.manager('settings').on('set', function(varName) {
    connectToGateway();
})

module.exports.init = function (devices, callback) {
    generateCapabilitiesFunctions();
    debugLog('init');
    debugLog(devices);

    devices.forEach(function(device) {
        var node = getNodeById(device.nodeId);
        var sensor = getSensorInNode(node, device, true);
    }) 
    connectToGateway();

    callback()
}

// Pairing functionality
module.exports.pair = function (socket) {
    socket.on('list_devices', function( data, callback ) {
        var devices = [];

        nodes.forEach(function(node){
            node.sensors.forEach(function(sensor){
                if(sensor.capabilities) {
                    addDeviceToSensor(node, sensor);
                    devices.push(sensor.device);
                }
            })
        });

        debugLog(devices);
        callback(null,devices);
    })

    socket.on('add_device', function( device, callback ) {
        debugLog('pair add_device');
        debugLog(device);
        callback();
    })
}

module.exports.renamed = function( device_data, new_name ) {
    // TODO
    debugLog('renamed');
    debugLog(device_data);
}

module.exports.deleted = function( device_data ) {
    // run when the user has deleted the device from Homey
    debugLog('deleted');
    debugLog(device_data);
}

// A user has updated settings, update the device object
module.exports.settings = function (device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback) {
  // TODO
  debugLog('settings');
  callback(null, true)
}

function generateCapabilitiesFunctions() {
    var localCapabilities = {}
    
    var specialFunctions = {
            get: function( device_data, callback ){
                var node = getNodeById(device_data.nodeId,false);
                var sensor = getSensorInNode(node, device_data);
                if( typeof callback == 'function' ) {
                    callback( null, sensor.payload );
                }
            }
    };

    mysensorsProtocol.req_set.forEach(function(item, index) {
        if(item.capabilities.sub_type != '') {
            if(localCapabilities[item.capabilities.sub_type] == null) {
                localCapabilities[item.capabilities.sub_type] = specialFunctions;
            }
        }
    });

    module.exports.capabilities = localCapabilities;
}

function handleMessage(message) {
    debugLog('----- handleMessage -------')
    debugLog(message)
    if(message) {
        switch(message.messageType) {
            case 'presentation': handlePresentation(message); break;
            case 'set': handleSet(message); break;
            case 'req': handleReq(message); break;
            case 'internal': handleInternal(message); break;
            case 'stream': handleStream(message); break;
        }
    }
}

function handlePresentation(message) {
    debugLog('----- presentation -------')
    var node = getNodeById(message.nodeId);
    var sensors = getSensorInNode(node, message);
    debugLog(node);
}

function handleSet(message) {
    debugLog('----- set -------')
    var node = getNodeById(message.nodeId);
    var sensor = getSensorInNode(node, message);

    if(sensor != null) {
        sensor.payload = message.payload;
        sensor.payloadType = message.subType;
        sensor.time = Date.now();

        debugLog(sensor);
        if(sensor.capabilities) {
            sensor.payload = mysensorsProtocol.parsePayload(sensor.capabilities.parse_value, message.payload);

            

            if(sensor.device) {
                var capa = sensor.capabilities.sub_type;
                if(sensor.capabilities.type == 'mysensors') {
                    capa = sensor.capabilities.sub_type.id;
                }

                debugLog('capability: ' + capa + ' payload: '+sensor.payload)
                module.exports.realtime(sensor.device.data, capa, sensor.payload, function(err, success) {
                    if (err) {
                        debugLog('! Realtime: ' + err); 
                    }
                    debugLog('Realtime: ' + success); 
                });
            }
        } else {
            debugLog('sensor have no capabilities')
        }
    }
}

function handleReq(message) {
    debugLog('----- req -------')
}

function handleInternal(message) {
    debugLog('----- internal -------')
    debugLog('subType: '+message.subType)
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
    debugLog('----- stream -------')
}

function sendData(messageObj) {
    // TODO
    debugLog('-- SEND DATA ----');
    var dataStr = mysensorsProtocol.encodeMessage(messageObj, gwSplitChar);
    debugLog(dataStr);

    if(settings.gatewayType == 'mqtt') {
        debugLog("SENDDATA to MQTT "+settings.publish_topic+'/'+dataStr);
        //gwClient.publish('presence', 'Hello mqtt');
    } else if(settings.gatewayType == 'ethernet') {
        debugLog("SENDDATA to ethernet "+dataStr);
        gwClient.write(dataStr + "\n");
    }
}

function getNextID(message) {
    debugLog('-- getNextID ----');
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

function getNodeById(nodeId, createNew) {
    debugLog("--- getNodeById ----")
    var node = null;
    nodes.forEach(function(item) {
        if(item.nodeId == nodeId) {
            node = item;
        }
    })

    if(createNew !== false) {
        if(node == null) {
            if(last_node_id < nodeId) {
                last_node_id = nodeId;
            }
            debugLog("--- NEW NODE ----")
            var node = {
                nodeId: nodeId,
                batteryLevel: '',
                sketchName: '',
                sketchVersion: '',
                sensors: []
            };
            nodes.push(node);
        }
    }
    
    return node;
}

function addDeviceToSensor(node, sensor) {
    var data_capabilities = [];
    if(sensor.capabilities) {
        data_capabilities.push(sensor.capabilities.sub_type);
    }

    sensor.device = {
        data: {
            id : node.nodeId + '_' + sensor.sensorId,
            nodeId: node.nodeId,
            sensorId: sensor.sensorId,
            sensorType: sensor.sensorType
        },
        name: node.nodeId + ':' + sensor.sensorId + ' ' + sensor.sensorType,
        capabilities    : data_capabilities
    };
}

function getSensorInNode(node, message, isDevice) {
    debugLog("--- getSensorInNode ----")
    var sensor = null;
    node.sensors.forEach(function(item) {
        if(item.sensorId == message.sensorId) {
            sensor = item;
        }
    })

    if(sensor == null) {
        debugLog("--- NEW SENSOR ----")
        var subType = message.subType;
        if(subType === undefined) {
            subType = message.sensorType;
        }
        var sensor = {
            sensorId: message.sensorId,
            sensorType: subType,
            payload: '',
            payloadType: '',
            time: '',
            device: null
        };

        sensor.capabilities = mysensorsProtocol.getCapabilities(sensor.sensorType);

        if(isDevice === true) {
            addDeviceToSensor(node, sensor);
        }

        node.sensors.push(sensor);
    } else {
        if(message.messageType == 'presentation') {
            if(sensor.sensorType != message.subType) {
                sensor.sensorType = message.subType;
            }
        }
    }

    return sensor;
}

function connectToGateway() {
    settings = Homey.manager('settings').get('mys_settings');
    debugLog(settings)
    if(settings) {
        if((settings.gatewayType == 'mqtt') && 
            (settings.host != '') && 
            (settings.port != '') && 
            (settings.publish_topic != '') && 
            (settings.subscribe_topic != '')) {

            debugLog("----MQTT-----")

            gwSplitChar = '/';
            topicPublish = settings.publish_topic;
            topicSubscribe = settings.subscribe_topic;

            gwClient = mqtt.connect('mqtt://'+settings.host+':'+settings.port);
     
            gwClient.on('connect', function () {
                debugLog('MQTT connected');
                gwClient.subscribe(topicPublish + '/#');
                gwClient.subscribe(topicSubscribe + '/#');
              
            }).on('message', function (topic, data) {
                var dataTopic = topic.substr(topic.indexOf('/')+1);
                var mqttTopic = topic.substr(0,topic.indexOf('/'));
                switch(mqttTopic) {
                    case topicPublish:
                        debugLog('publish');
                        break;
                    case topicSubscribe:
                        debugLog('subscribe');
                        break;
                }
                
                debugLog(topic + ' : '+ data);
                handleMessage(mysensorsProtocol.decodeMessage(dataTopic+'/'+data, gwSplitChar))
            }).on('reconnect', function () {
                debugLog('MQTT reconnect');
            }).on('close', function () {
                debugLog('MQTT disconnected');
            }).on('error', function (error) {
                debugLog('MQTT error');
                debugLog(error);
            });

        } else if((settings.gatewayType == 'ethernet') && 
                (settings.host != '') && 
                (settings.port != '') && 
                (settings.timeout != '')) {

            debugLog("----Ethernet-----")
            gwSplitChar = ';';
            gwClient = net.Socket();
            gwClient.connect(settings.port, settings.host);

            gwClient.setEncoding('ascii');
            gwClient.setTimeout(parseInt(settings.timeout));
            gwClient.on('connect', function() {
                debugLog('Ethernet connected');
            }).on('data', function(data) {
                handleMessage(mysensorsProtocol.decodeMessage(data, gwSplitChar))
            }).on('end', function() {
                debugLog('Ethernet disconnected');

            }).on('error', function() {
                debugLog('Ethernet error');
            });
        } else {
            debugLog("----TEST-----")
        }
    }
}

function debugLog(str) {
    Homey.log(str);
}
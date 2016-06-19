var mysensorsProtocol = require('./mysensorsProtocol');
var deviceClasses = require('./deviceclasses.json');
var mqtt = require('mqtt');
var net = require('net');

var gwSplitChar = null;
var nodes = {};
var gwClient = null;
var gwIsConnected = false;
var connectionTimer = null;
var settings = {};

const FIRMWARE_BLOCK_SIZE = 16;
const BROADCAST_ADDRESS = 255;
const NODE_SENSOR_ID = 255;
var last_node_id = 0;

// Export capabilities
module.exports.capabilities = {}

Homey.manager('settings').on('set', function(varName) {
    if(gwClient != null) {
        gwClient.end();
    }
    connectToGateway();
})

function startConnectionTimer() {
    if(connectionTimer !== null) {
        clearInterval(connectionTimer);
    }
    
    connectionTimer = setInterval(connectToGateway, 60000);
}
module.exports.init = function (devices_data, callback) {
    debugLog('init');
    generateCapabilitiesFunctions();
    debugLog(devices_data);

    devices_data.forEach(function(device_data) {
        var node = getNodeById(device_data.nodeId);
        var sensor = getSensorInNode(node, device_data, true);

        getDeviceInfo(sensor, function(err) {
            sensor.device.isAdded = true;
        });
    }) 

    connectToGateway();
    createFlowListener();

    callback()
}

function getDeviceInfo(sensor, callback) {
    module.exports.getName( sensor.device.data, function( err, data) {
        sensor.device.name = data;
        module.exports.getClass( sensor.device.data, function( err, data) {
            sensor.device.class = data;

            module.exports.getCapabilities( sensor.device.data, function(err, data) {
                if(data !== undefined) {
                    data.forEach(function(capa) {
                        var capability = {};
                        capability.type = sensor.device.class;
                        capability.sub_type = capa.id;
                        capability.parse_value = deviceClasses.capabilities[capability.sub_type].type;
                        sensor.device.capabilities = [];
                        sensor.device.capabilities.push(capability.sub_type);

                        sensor.capabilities = capability;

                        callback(null);
                    })
                }
            })
        })
    })
}

// Pairing functionality
module.exports.pair = function (socket) {

    socket.on('select_capabilities', function( data, callback ) {
        debugLog('select_capabilities');
        var devices = [];

        for(var nodeId in nodes){
            var node = nodes[nodeId];
            if(node !== undefined) {
                for(var sensorId in node.sensors){
                    var sensor = node.sensors[sensorId];
                    if(sensor !== undefined) {
                        addDeviceToSensor(node, sensor);
                        if(!sensor.device.isAdded) {
                            devices.push(sensor.device);
                        }
                    }
                }
            }
        }
        callback( devices , deviceClasses.devices);
    });
    
    socket.on('addedSensor', function( device_data, callback ) {
        var node = nodes[device_data.data.nodeId];
        var sensor = node.sensors[device_data.data.sensorId];
        if(sensor.capabilities) {
            sensor.capabilities.type = device_data.class;
            sensor.capabilities.sub_type = device_data.capabilities[0];
            sensor.capabilities.parse_value = deviceClasses.capabilities[sensor.capabilities.sub_type].type;
        }

        device_data.isAdded = true;
        sensor.device = device_data;
        debugLog('addedSensor');
        debugLog(sensor);

        callback(null, sensor.device);
    });
}

module.exports.renamed = function( device_data, new_name ) {
    var node = nodes[device_data.nodeId];
    var sensor = node.sensors[device_data.sensorId];
    sensor.device.name = new_name;
}

module.exports.deleted = function( device_data ) {
    var node = nodes[device_data.nodeId];
    var sensor = node.sensors[device_data.sensorId];
    sensor.device.isAdded = false;
}

// A user has updated settings, update the device object
module.exports.settings = function (device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback) {
  // TODO
  debugLog('settings');
  callback(null, true)
}

function createFlowListener() {
    Homey.manager('flow').on('trigger.value_changed', function( callback, args, state ){
        debugLog('FLOW = trigger.value_changed')
        callback( null, true );
    });
    Homey.manager('flow').on('trigger.value_on', function( callback, args, state ){
        debugLog('FLOW = trigger.value_on')
        callback( null, true );
    });
    Homey.manager('flow').on('trigger.value_off', function( callback, args, state ){
        debugLog('FLOW = trigger.value_off');
        callback( null, true );
    });

    Homey.manager('flow').on('condition.value_is', function( callback, args ){
        debugLog('FLOW = condition.value_is')
        var node_sensor = getNodeAndSensorFromDevice(args.device);
        var sensor = node_sensor.sensor;

        callback( null, (args.value_is === sensor.payload) );
    });

    Homey.manager('flow').on('condition.onoff', function( callback, args ){
        debugLog('FLOW = condition.onoff')
        var node_sensor = getNodeAndSensorFromDevice(args.device);
        var sensor = node_sensor.sensor;

        var testValue = args.value_is;
        switch(testValue) {
            case 'true':
                testValue = true;
                break;
            case 'false':
                testValue = false;
                break;
        }
        callback( null, (testValue === sensor.payload) );
    });

    Homey.manager('flow').on('action.set_text', function( callback, args ){
        debugLog('FLOW = action.set_text')
        actionSet(args, args.value, function(result ) {
            callback( null, result );
        })
    });

    Homey.manager('flow').on('action.set_number', function( callback, args ){
        debugLog('FLOW = action.set_number')
        actionSet(args, args.value, function(result ) {
            callback( null, result );
        })
    });

    Homey.manager('flow').on('action.set_onoff', function( callback, args ){
        debugLog('FLOW = action.set_onoff')
        actionSet(args, args.value, function(result ) {
            callback( null, result );
        })
    });
}

function actionSet(args, value, callback) {
    debugLog(args)
    var node_sensor = getNodeAndSensorFromDevice(args.device);
    var node = node_sensor.node;
    var sensor = node_sensor.sensor;

    args.device.payload = value;
    args.device.subType = sensor.payloadType;

    handleSet(args.device, true, false, true);
    callback( true );
}

function generateCapabilitiesFunctions() {
    var localCapabilities = {}
    
    var specialFunctions = {
            get: function( device_data, callback ){
                debugLog("---SPECIAL GET")
                debugLog(device_data);
                debugLog("SPECIAL GET---")
                var node_sensor = getNodeAndSensorFromDevice(device_data);
                var sensor = node_sensor.sensor;
                if( typeof callback == 'function' ) {
                    callback( null, sensor.payload );
                }
            },
            set: function( device_data, value, callback ) {
                debugLog("---SPECIAL SET")
                debugLog(device_data);
                debugLog(value)
                debugLog("SPECIAL SET---")
                var node_sensor = getNodeAndSensorFromDevice(device_data);
                var sensor = node_sensor.sensor;
                device_data.payload = value;
                device_data.subType = sensor.payloadType;

                handleSet(device_data, true, true, true);
                if( typeof callback == 'function' ) {
                    callback( null, device_data.payload );
                }
            }
    };

    for(var capabilityname in deviceClasses.capabilities){
        if(localCapabilities[capabilityname] == null) {
            localCapabilities[capabilityname] = specialFunctions;
        }
    }

    module.exports.capabilities = localCapabilities;
}

function handleMessage(message) {
    if(message) {
        debugLog('----- handleMessage -------')
        debugLog(message)
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

function parsePayload(capabilities, value) {
    var newValue = null;
    var capability = deviceClasses.capabilities[capabilities];
    debugLog('value = '+value);
    if(capability) {
        switch(capability.type) {
            case 'number': newValue = parseFloat(value); break;
            case 'enum': newValue = value; break;
            case 'boolean': 
                if(value == 0) {
                    newValue = false;
                } else {
                    newValue = true;
                }
                break;
            default: newValue = value;
        }
    }
    debugLog('return value = '+newValue);
    return newValue;
}

function handleSet(message, isDeviceData, triggerFlow, sendSetData) {
    if (typeof isDeviceData === 'undefined') {
        isDeviceData = false;
    }
    if (typeof triggerFlow === 'undefined') {
        triggerFlow = true;
    }
    if (typeof sendSetData === 'undefined') {
        sendSetData = false;
    }

    debugLog('----- set -------')
    var node = getNodeById(message.nodeId);
    var sensor = getSensorInNode(node, message, isDeviceData);

    if(sensor != null) {
        sensor.payloadType = message.subType;
        sensor.time = Date.now();

        debugLog(sensor);
        if(sensor.capabilities) {
            var old_payload = sensor.payload;

            if(sensor.device) {
                var capability = sensor.capabilities.sub_type;
                sensor.payload = parsePayload(capability, message.payload);
                debugLog('capability: ' + capability + ' payload: '+sensor.payload)
                module.exports.realtime(sensor.device.data, capability, sensor.payload, function(err, success) {
                    if (err) {
                        debugLog('! Realtime: ' + err); 
                    }
                    debugLog('Realtime: ' + success); 
                });
                if(triggerFlow) {
                    if(old_payload != sensor.payload) {
                        Homey.manager('flow').triggerDevice('value_changed', { current_value: sensor.payload }, null, sensor.device.data, function(err, result) {
                            debugLog("trigger flow.value_changed = "+ node.nodeId +':'+ sensor.sensorId)
                        });
                    }
                    
                    switch(sensor.payload) {
                        case true:
                            Homey.manager('flow').triggerDevice('value_on', { current_value: sensor.payload }, null, sensor.device.data, function(err, result) {
                                debugLog("trigger flow.value_on = "+ node.nodeId +':'+ sensor.sensorId)
                            });
                            break;
                        case false:
                            Homey.manager('flow').triggerDevice('value_off', { current_value: sensor.payload }, null, sensor.device.data, function(err, result) {
                                debugLog("trigger flow.value_off = "+ node.nodeId +':'+ sensor.sensorId)
                            });
                            break;
                    }
                }

                if(sendSetData) {
                    sendData({
                        nodeId: node.nodeId,
                        sensorId: sensor.sensorId,
                        messageType: 'set',
                        ack: 0,
                        subType: sensor.payloadType,
                        payload: sensor.payload
                    });
                }
            }
        } else {
            sensor.payload = message.payload;
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
        case 'I_VERSION': 
            if(message.nodeId > 0) {
                var node = getNodeById(message.nodeId);
                if(node.sketchName !== message.payload) {
                    node.sketchName = message.payload;
                }
            }
            break;
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
    debugLog('Not implemented')
}

function sendData(messageObj) {
    debugLog('-- SEND DATA ----');
    if(messageObj.subType == '') {
        var node = nodes[messageObj.nodeId];
        var sensor = node.sensors[messageObj.sensorId];

        var firstChar = sensor.sensorType.charAt(0);

        if(firstChar == 'S') {
            mysensorsProtocol.presentation.forEach(function(item, index) {
                if(item.value == sensor.sensorType) {
                    if(item.variables.length > 0) {
                        messageObj.subType = item.variables[0];
                    }
                }
            });
        } else if(firstChar == 'V') {
            messageObj.subType = sensor.sensorType;
        }
    }
    var dataStr = mysensorsProtocol.encodeMessage(messageObj, gwSplitChar, settings.gatewayType);
    debugLog(dataStr);

    if(gwClient != null) {
        if(settings.gatewayType == 'mqtt') {
            debugLog("SENDDATA to MQTT "+settings.publish_topic+'/'+dataStr.message_str);
            gwClient.publish(settings.publish_topic+'/'+dataStr.message_str, dataStr.payload);
        } else if(settings.gatewayType == 'ethernet') {
            debugLog("SENDDATA to ethernet "+dataStr);
            gwClient.write(dataStr + "\n");
        }
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

function getNodeAndSensorFromDevice(device) {
    var node = getNodeById(device.nodeId, false);
    var sensor = getSensorInNode(node, device, true);
    return {node: node, sensor: sensor}
}

function getNodeById(nodeId, createNew) {
    if (typeof createNew === 'undefined') {
        createNew = true;
    }
    debugLog("--- getNodeById ----")
    var node = nodes[nodeId];

    if(createNew !== false) {
        if(node === undefined) {
            if(last_node_id < nodeId) {
                last_node_id = nodeId;
            }
            debugLog("--- NEW NODE ----")
            var node = {
                nodeId: nodeId,
                batteryLevel: '',
                sketchName: '',
                sketchVersion: '',
                version: '',
                sensors: {}
            };
            nodes[node.nodeId] = node;
        }
    }
    
    return node;
}

function addDeviceToSensor(node, sensor) {
    var data_capabilities = [];
    var data_class = "";
    if(sensor.capabilities) {

        var sensor_capability = sensor.capabilities.sub_type;
        data_class = sensor.capabilities.type;

        data_capabilities.push(sensor_capability);
    }
    debugLog(sensor);
    if(sensor.device == null) {
        sensor.device = {
            data: {
                id: node.nodeId + '_' + sensor.sensorId,
                nodeId: node.nodeId,
                sensorId: sensor.sensorId,
                sensorType: sensor.sensorType
            },
            isAdded: false,
            name: node.nodeId + ':' + sensor.sensorId + ' ' + sensor.sensorType,
            class: data_class,
            capabilities: data_capabilities
        };
    }
}

function getSensorInNode(node, message, isDeviceData) {
    if (typeof isDeviceData === 'undefined') {
        isDeviceData = false;
    }
    debugLog("--- getSensorInNode ----")
    var sensor = node.sensors[message.sensorId];

    if(sensor === undefined) {
        if(message.sensorId == BROADCAST_ADDRESS) {
            if(message.messageType == 'presentation') {
                if(message.subType == 'S_ARDUINO_NODE') {
                    node.version = message.payload;
                }
            }
        } else {
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
            if(sensor.capabilities != null) {
                sensor.capabilities.parse_value = deviceClasses.capabilities[sensor.capabilities.sub_type].type;
            }

            if(isDeviceData === true) {
                addDeviceToSensor(node, sensor);
            }

            node.sensors[sensor.sensorId] = sensor;
        }
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
    if(settings && (gwIsConnected === false)) {
        if((settings.gatewayType == 'mqtt') && 
            (settings.mqtt_host != '') && 
            (settings.mqtt_port != '') && 
            (settings.publish_topic != '') && 
            (settings.subscribe_topic != '')) {

            debugLog("----MQTT-----")

            gwSplitChar = '/';
            topicPublish = settings.publish_topic;
            topicSubscribe = settings.subscribe_topic;

            gwClient = mqtt.connect('mqtt://'+settings.mqtt_host+':'+settings.mqtt_port);
     
            gwClient.on('connect', function () {
                if(gwClient != null) {
                    clearInterval(connectionTimer);
                    gwIsConnected = true;
                    debugLog('MQTT connected');
                    gwClient.subscribe(topicPublish + '/#');
                    gwClient.subscribe(topicSubscribe + '/#');
                }
              
            }).on('message', function (topic, data) {
                var dataTopic = topic.substr(topic.indexOf('/')+1);
                var mqttTopic = topic.substr(0,topic.indexOf('/'));

                switch(mqttTopic) {
                    case topicPublish:
                        //debugLog('publish');
                        break;
                    case topicSubscribe:
                        debugLog('subscribe');
                        handleMessage(mysensorsProtocol.decodeMessage(dataTopic+'/'+data, gwSplitChar))
                        break;
                }
            }).on('reconnect', function () {
                debugLog('MQTT reconnect');
            }).on('close', function () {
                debugLog('MQTT disconnected');
                startConnectionTimer();
                gwClient = null;
                gwIsConnected = false;
            }).on('error', function (error) {
                debugLog('MQTT error');
                debugLog(error);
            });

        } else if((settings.gatewayType == 'ethernet') && 
                (settings.ethernet_host != '') && 
                (settings.ethernet_port != '') && 
                (settings.timeout != '')) {

            debugLog("----Ethernet-----")
            gwSplitChar = ';';
            gwClient = net.Socket();
            gwClient.connect(settings.ethernet_port, settings.ethernet_host);
            if(settings.timeout === undefined) {
                settings.timeout = 60000;
            }
            gwClient.setEncoding('ascii');
            gwClient.setTimeout(parseInt(settings.timeout));
            gwClient.on('connect', function() {
                clearInterval(connectionTimer);
                gwIsConnected = true;
                debugLog('Ethernet connected');
            }).on('data', function(data) {
                var dataArr = data.split('\n');
                dataArr.forEach(function(data_str, index) {
                    handleMessage(mysensorsProtocol.decodeMessage(data_str, gwSplitChar))
                });
            }).on('end', function() {
                debugLog('Ethernet disconnected');
                startConnectionTimer();
                gwClient = null;
                gwIsConnected = false;
            }).on('error', function(err) {
                debugLog('Ethernet error'+err.message);
            });
        } else {
            debugLog("----TEST-----")
        }
    } else {
        startConnectionTimer();
    }
}

function debugLog(str) {
    Homey.log(str);
}
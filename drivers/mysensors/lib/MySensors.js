'use strict';
const util = require('util')
const events = require('events');
var mysensorsProtocol = require('./mysensorsProtocol');
var deviceClasses = require('./deviceclasses.json');
var Node = require('./NodeClass.js');
var mqtt = require('mqtt');
var net = require('net');

class MySensors extends events.EventEmitter {
	constructor() {
		super();

		this.gwSplitChar = null;
		this.nodes = {};
		this.gwClient = null;

		this.gwIsConnected = false;
		this.discoverTimer = null;
		this.connectionTimer = null;
		this.settings = {};

		this.FIRMWARE_BLOCK_SIZE = 16;
		this.BROADCAST_ADDRESS = 255;
		this.NODE_SENSOR_ID = 255;
		this.last_node_id = 0;

		this.showDebugLog = true;
		this.debugLogArr = [];
		this.messageLog = [];
		this.localCapabilities = {}
		
		this.ackMessages = []
		this.ack_received = false;
		this.ack_nodeId = null;
		this.ack_sensorId = null;
		this.ack_subType = null;
		this.ack_totalRepeats = 2;
		this.ack_repeat = 2;

	}

	setShowDebugLog(value) {
		this.showDebugLog = value;
	}

	settingsSet() {
		this.debugLog('settingsSet');
        if(this.gwClient != null) {
             this.gwClient.end();
        }
        this.connectToGateway();
	}

	generateCapabilitiesGetSet() {
		var localCapabilities = {}

	    for(var capabilityname in this.getDeviceClassesCapabilities()){
	    	for (var i = 0; i <= 255; i++) {
	    		var newCapabilityname = capabilityname+'.'+i;
	    		if(localCapabilities[newCapabilityname] == null) {
		            localCapabilities[newCapabilityname] = this.getSetCapability(newCapabilityname);
		        }
	    	}
	    }
	    return localCapabilities;
	}

	getDeviceClassesCapabilities() {
		return Object.assign(deviceClasses.capabilities, Homey.manifest.capabilities)
	}

	initPair(data, callback ) {
		this.debugLog('initPair - this');
	    var devices = [];

	    for(var nodeId in this.nodes){
	        var node = this.getNodeById(nodeId);
	        if(node !== undefined) {
	            if(!node.getIsAdded()) {
					if(node.getNumSensors() > 0) {
						devices.push(node);
					}
	            }
	        }
	    }
	    var extra = {};
	    extra.mysensors_types = mysensorsProtocol.req_set;
	    extra.homey_capabilities = this.getDeviceClassesCapabilities();
	    callback( devices , extra);
	}

	addedNodePair(data, callback) {
		this.debugLog('addedNodePair')
		var node = this.getNodeById(data.nodeId);
	    if(node !== undefined) {
	        node.saveNodeFromPair(data, (err) => {
	            if(err == null) {
	            	node.addNodeToDevice();
				    var node_device = node.createDeviceObject();


				    this.debugLog('addedNodePair', util.inspect(node_device, false, null))
				    callback( null, node_device);
	            } else {
	                callback( "Could not save node" , err);
	            }
	        });
	    } else {
	        callback("Node do not exists");
	    }
	    
	}

	addedDevicePair(node_device, callback) {
	    this.debugLog('addedDevicePair')

	    var device_data = node_device.data;
	    var node = this.getNodeById(device_data.nodeId);
	    node.triggerSensorValue();

	    callback("done");
	}

	renameDevice(device_data, new_name) {
	    this.debugLog('renameDevice')
	    var node = this.getNodeById(device_data.nodeId);
	    if(node != null) {
	        node.setName(new_name);
	    }
	}

	deletedDevice(device_data) {
	    this.debugLog('deletedDevice')
	    var node = this.getNodeById(device_data.nodeId);
	    node.deleteNode();
	}

	getSetCapability(capability) {
	    
	    var specialFunctions = {
	        get: ( device_data, callback ) => {
	            
	            var node = this.getNodeById(device_data.nodeId);
	            if( typeof callback == 'function' ) {
	            	var value = null;
	            	if((node.getShowBatteryLevel()) && (capability == 'measure_battery.255')) {
		                value = node.getBatteryLevel();
	            	} else if((node.getShowLastSeen()) && (capability == 'mysensors_lastseen.255')) {
		                value = node.getLastSeen();
	            	} else {
	                    var sensor = node.getSensorByCapability(capability);
	                    if(sensor != null) {
	    	                value = sensor.parsePayload();
	    	                if(capability == "dim") {
	    	                    value = value/100;
	    	                }
	                    } else {
	                        value = null;
	                    }
	            	}
	            	
	                callback( null, value);
	            }
	        },

	        set: ( device_data, value, callback ) => {
	            if( typeof callback == 'function' ) {
	                var node = this.getNodeById(device_data.nodeId);
	                if((node.getShowBatteryLevel()) && (capability == 'measure_battery.255')) {
	                    node.setShowBatteryLevel(value);
	                } else if((node.getShowLastSeen()) && (capability == 'mysensors_lastseen.255')) {
		                node.setLastSeen(value);
	            	} else {
	                    var sensor = node.getSensorByCapability(capability);
	                    if(sensor != null) {
	                        sensor.setPayloadFromCapabilitySet(value);
	                    } else {
	                        this.debugLog("sensor = null");
	                    }
	                }
	                callback( null, value );
	            }
	        }
	    };
	    return specialFunctions;
	}

	startConnectionTimer() {
	    if(this.connectionTimer !== null) {
	        clearInterval(this.connectionTimer);
	    }
	    
	    this.connectionTimer = setInterval(() => {
	    	this.connectToGateway();
	    }, 60000 );
	}

	connectToGateway() {
		this.settings = Homey.manager('settings').get('mys_settings');

	    if(this.settings && (this.gwIsConnected === false)) {
	        if((this.settings.gatewayType == 'mqtt') && 
	            (this.settings.mqtt_host != '') && 
	            (this.settings.mqtt_port != '') && 
	            (this.settings.publish_topic != '') && 
	            (this.settings.subscribe_topic != '')) {

	            this.debugLog("----MQTT-----")

	            this.gwSplitChar = '/';
	            this.topicPublish = this.settings.publish_topic;
	            this.topicSubscribe = this.settings.subscribe_topic;
	            this.debugLog('mqtt://'+this.settings.mqtt_host+':'+this.settings.mqtt_port);
	            this.gwClient = mqtt.connect('mqtt://'+this.settings.mqtt_host+':'+this.settings.mqtt_port);
	     
	            this.gwClient.on('connect', () => {
	                if(this.gwClient != null) {
	                    clearInterval(this.connectionTimer);
	                    this.gwIsConnected = true;
	                    this.debugLog('MQTT connected');
	                    this.gwClient.subscribe(this.topicPublish + '/#');
	                    this.gwClient.subscribe(this.topicSubscribe + '/#');
	                    this.sendDiscoverMessage();
	                    this.startDiscoverTimer();
	                }
	              
	            }).on('message', (topic, data) => {
	                var dataTopic = topic.substr(topic.indexOf('/')+1);
	                var mqttTopic = topic.substr(0,topic.indexOf('/'));

	                switch(mqttTopic) {
	                    case this.topicPublish:
	                        //this.debugLog('publish');
	                        break;
	                    case this.topicSubscribe:
	                        this.handleMessage(this.decodeMessage(dataTopic+'/'+data, this.gwSplitChar))
	                        break;
	                }
	            }).on('reconnect', () => {
	                this.debugLog('MQTT reconnect');
	            }).on('close', () => {
	                this.debugLog('MQTT disconnected');
	                this.startConnectionTimer();
	                this.gwClient = null;
	                this.gwIsConnected = false;
	            }).on('error', (error) => {
	                this.debugLog('MQTT error');
	                this.debugLog(error);
	            });

	        } else if((this.settings.gatewayType == 'ethernet') && 
	                (this.settings.ethernet_host != '') && 
	                (this.settings.ethernet_port != '') && 
	                (this.settings.timeout != '')) {

	            this.debugLog("----Ethernet-----")
	            this.gwSplitChar = ';';
	            this.gwClient = net.Socket();
	            this.gwClient.connect(this.settings.ethernet_port, this.settings.ethernet_host);
	            if(this.settings.timeout === undefined) {
	                this.settings.timeout = 60000;
	            }
	            this.gwClient.setEncoding('ascii');
	            this.gwClient.setTimeout(parseInt(this.settings.timeout));
	            this.gwClient.on('connect', () => {
	                clearInterval(this.connectionTimer);
	                this.gwIsConnected = true;
	                this.debugLog('Ethernet connected');
	                this.sendDiscoverMessage();
	                this.startDiscoverTimer();
	                
	            }).on('data', (data) => {
	                var dataArr = data.split('\n');
	                dataArr.forEach((data_str, index) => {
	                    this.handleMessage(this.decodeMessage(data_str, this.gwSplitChar))
	                });
	            }).on('end', () => {
	                this.debugLog('Ethernet disconnected');
	                this.startConnectionTimer();
	                this.gwClient = null;
	                this.gwIsConnected = false;
	            }).on('error', (err) => {
	                this.debugLog('Ethernet error'+err.message);
	                this.startConnectionTimer();
	                this.gwClient = null;
	                this.gwIsConnected = false;
	            });
	        } else {
	            this.debugLog("----TEST-----")
	        }
	    } else {
	        this.startConnectionTimer();
	    }
	}

	startDiscoverTimer() {
	    if(this.discoverTimer !== null) {
	        clearInterval(this.discoverTimer);
	    }
	    this.discoverTimer = setInterval(() => {
	    	this.sendDiscoverMessage();
	    }, 3600000 );
	}

	sendDiscoverMessage() {
	    this.debugLog("sendDiscoverMessage")
	    this.sendData({
	        nodeId: this.BROADCAST_ADDRESS,
	        sensorId: this.NODE_SENSOR_ID,
	        messageType: 'internal',
	        ack: 0,
	        subType: 'I_DISCOVER',
	        payload: '0'
	    });
	}

	addMySensorsEventListener(node) {

	    node.on('nodeSensorSendSetMessage', (message, callback) => {
	        this.debugLog('MySensors.js nodeSensorSendSetMessage', message)
	        this.sendSetMessage(message, callback);
	    })

	    node.on('nodeSensorTriggerValue', (eventName, sensor, nodeDeviceData, value) => {
	        this.debugLog('MySensors.js nodeSensorTriggerValue ', eventName)
	        this.debugLog(value);
	        this.emit('nodeSensorTriggerValue', eventName, sensor, nodeDeviceData, value);
	    })

	    node.on('nodeSensorRealtimeUpdate', (nodeDeviceData, capability, payload) => {
	        this.emit('nodeSensorRealtimeUpdate', nodeDeviceData, capability, payload);
	    })
	}

	ackSendFunction(messageObj, callback) {
		if(this.ack_received == false) {
			this.sendData(messageObj)
			if(messageObj.ack == 0) {
				callback(true);
			} else {
				if(this.ack_repeat < this.ack_totalRepeats) {
					setTimeout(() => {
							this.ack_repeat++;
							this.ackSendFunction(messageObj, callback)
					}, 2000);
				} else {
					callback(this.ack_received);
				}
			}
		} else {
			callback(this.ack_received);
		}

	}
	sendSetMessage(messageObj, callback) {
		this.debugLog('-- SEND sendSetMessage ----');

		this.ack_received = false;
		this.ack_nodeId = messageObj.nodeId;
		this.ack_sensorId = messageObj.sensorId;
		this.ack_subType = messageObj.subType;
		this.ack_repeat = 0;

		if((this.ack_received == false)) {
			this.ackSendFunction(messageObj, (result) => {
				callback(result);
			})
		}
	}

	sendData(messageObj) {
	    this.debugLog('-- SEND DATA ----');
	    if(messageObj.subType == '') {
	        var node = this.getNodeById(messageObj.nodeId);
	        var sensor = node.getSensorById(messageObj.sensorId);

	        var firstChar = sensor.sensorType.charAt(0);

	        if(firstChar == 'S') {
	            mysensorsProtocol.presentation.forEach((item, index) => {
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

	    var returnObj = mysensorsProtocol.encodeMessage(messageObj, this.gwSplitChar, this.settings.gatewayType);
	    var dataStr = returnObj.returnMessage;
	    this.mySensorMessageLog(returnObj.messageObj);

	    this.debugLog(dataStr);

	    if(this.gwClient != null) {
	        if(this.settings.gatewayType == 'mqtt') {
	            this.debugLog("SENDDATA to MQTT "+this.settings.publish_topic+'/'+dataStr.message_str);
	            this.gwClient.publish(this.settings.publish_topic+'/'+dataStr.message_str, dataStr.payload);
	        } else if(this.settings.gatewayType == 'ethernet') {
	            this.debugLog("SENDDATA to ethernet "+dataStr);
	            this.gwClient.write(dataStr + "\n");
	        }
	    }
	}

	getNextID(message) {
	    this.debugLog('-- getNextID ----');
	    if(this.last_node_id <= this.NODE_SENSOR_ID-1) {
	        this.last_node_id++;
	    }

	    this.sendData({
	        nodeId: message.nodeId,
	        sensorId: message.sensorId,
	        messageType: message.messageType,
	        ack: 0,
	        subType: 'I_ID_RESPONSE',
	        payload: this.last_node_id
	    });
	}

	decodeMessage(data_str, gwSplitChar) {
	    return mysensorsProtocol.decodeMessage(data_str, gwSplitChar);
	}

	actionSet(args, callback) {

	    var node = this.getNodeById(args.device.nodeId);
	    if(node !== null) {
		    var sensor = node.getSensorById(args.sensorId.sensorId);
		    if(sensor !== null) {
			    callback( null, sensor.setPayloadFromAction(args.value) );
			} else {
				callback( null, false );
			}
		} else {
			callback( null, false );
		}
	}

	getNodeById(nodeId) {
		var node = this.nodes[nodeId];

	    if(node === undefined) {
	        if(this.last_node_id < nodeId) {
	            this.last_node_id = nodeId;
	        }
	        var node = new Node(nodeId);
	        this.addMySensorsEventListener(node);

	        this.nodes[node.nodeId] = node;
	    }
	    
	    return node;
	}

	receivedAckMessage(messageObj) {

		if ((messageObj.ack == 1) &&
			(messageObj.nodeId == this.ack_nodeId) &&
			(messageObj.sensorId == this.ack_sensorId) &&
			(messageObj.subType == this.ack_subType)){

			this.ack_received = true;
			this.ack_nodeId = null;
			this.ack_sensorId = null;
			this.ack_subType = null;
			return false;
		}

		return true;	
	}

	handleMessage(message) {
	    if(message) {
	        this.mySensorMessageLog(message);
	        this.debugLog('----- handleMessage -------')
	        switch(message.messageType) {
	            case 'presentation': this.handlePresentation(message); break;
	            case 'set': this.handleSet(message); break;
	            case 'req': this.handleReq(message); break;
	            case 'internal': this.handleInternal(message); break;
	            case 'stream': this.handleStream(message); break;
	        }
	    }
	}

	handlePresentation(message) {
	    this.debugLog('----- presentation -------')
	    var node = this.getNodeById(message.nodeId);
	    node.setLastSeen();
	    var sensor = node.getSensorById(message.sensorId);

	    if(sensor === undefined) {
	        if(message.sensorId == this.BROADCAST_ADDRESS) {
	            if(message.messageType == 'presentation') {
	                if(message.subType == 'S_ARDUINO_NODE') {
	                    node.setSketchVersion(message.payload);
	                }
	            }
	        }
	    } else {
	        if(message.messageType == 'presentation') {
	            if(sensor.getSensorType() != message.subType) {
	                sensor.setSensorType(message.subType);
	            }
	        }
	    }
	}

	handleSet(message) {
		this.debugLog('----- set -------')

		var handleThisMessage = true;
		if(message.ack == 1) {
			handleThisMessage = this.receivedAckMessage(message)
	    }

	    if(handleThisMessage) {
		    var node = this.getNodeById(message.nodeId);
		    node.setLastSeen();
		    var sensor = node.getSensorFromMessage(message);

		    if(sensor != null) {
		        sensor.payloadType = message.subType;
		        sensor.setPayloadFromMessage(message.payload);
		    }
	    }
	}

	handleReq(message) {
	    this.debugLog('----- req -------')
	    var node = this.getNodeById(message.nodeId);
	    node.setLastSeen();
	    var sensor = node.getSensorFromMessage(message);

	    if(sensor != null) {
	    	this.sendData({
                nodeId: message.nodeId,
                sensorId: message.sensorId,
                messageType: message.messageType,
                ack: 0,
                subType: message.subType,
                payload: sensor.getPayload()
            });
	    }
	}

	handleInternal(message) {
	    this.debugLog('----- internal -------')
	    this.debugLog('subType: '+message.subType)
	    switch(message.subType) {
	        case 'I_BATTERY_LEVEL': 
	            var node = this.getNodeById(message.nodeId);
	            node.setLastSeen();
	            node.setBatteryLevel(message.payload);
	            break;
	        case 'I_TIME':
	            this.sendData({
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
	                var node = this.getNodeById(message.nodeId);
	                node.setLastSeen();
	                node.setVersion(message.payload);
	            }
	            break;
	        case 'I_ID_REQUEST': 
	            this.getNextID(message);
	            break;
	        case 'I_ID_RESPONSE': break;
	        case 'I_INCLUSION_MODE': break;
	        case 'I_CONFIG': 
	            this.sendData({
	                nodeId: message.nodeId,
	                sensorId: this.NODE_SENSOR_ID,
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
	            var node = this.getNodeById(message.nodeId);
	            node.setLastSeen();
	            node.setSketchName(message.payload);
	            break;
	        case 'I_SKETCH_VERSION': 
	            var node = this.getNodeById(message.nodeId);
	            node.setLastSeen();
	            node.setSketchVersion(message.payload);
	            break;
	        case 'I_REBOOT': break;
	        case 'I_GATEWAY_READY': break;
	        case 'I_REQUEST_SIGNING': break;
	        case 'I_GET_NONCE': break;
	        case 'I_GET_NONCE_RESPONSE': break;
	        case 'I_HEARTBEAT': break;
	        	this.sendData({
	                nodeId: '0',
	                sensorId: '0',
	                messageType: message.messageType,
	                ack: 0,
	                subType: message.subType,
	                payload: 'PING'
	            });
	        case 'I_PRESENTATION': break;
	        case 'I_DISCOVER': break;
	        case 'I_DISCOVER_RESPONSE': break;
	        	/*
	        	node = getNode(mcMessage);
                node.setParentNodeEui(mcMessage.getPayload());
				updateNode(node);
				*/
	        case 'I_HEARTBEAT_RESPONSE': break;
	        case 'I_LOCKED': break;
	        case 'I_PING': break;
	        case 'I_PONG': break;
	        case 'I_REGISTRATION_REQUEST':
	        	// TODO 
	            // this.sendData({
	            //     nodeId: message.nodeId,
	            //     sensorId: this.NODE_SENSOR_ID,
	            //     messageType: message.messageType,
	            //     ack: 0,
	            //     subType: 'I_REGISTRATION_RESPONSE',
	            //     payload: 'M'
	            // });
	        	break;
	        case 'I_REGISTRATION_RESPONSE': break;
	        case 'I_DEBUG': 
	        	// TODO
	            break;
	    }
	}

	handleStream(message) {
	    this.debugLog('----- stream -------')
	    this.debugLog('Not implemented')
	}

	mySensorMessageLog(message) {
		this.messageLog = Homey.manager('settings').get('mySensorMessageLog');

		if (!this.messageLog) {
			this.messageLog = [];
		}

		this.debugLog(message);

        var newRow = {
            "Timestamp": new Date(message.debugObj.t),
            "Direction": message.direction,
            "Node": message.nodeId,
            "Sensor": message.sensorId,
            "Type": message.messageType,
            "Ack": message.ack,
            "MessageType": message.subType,
            "Payload": message.payload,
            "Debug": message.debugObj.s,
        };

        this.messageLog.push(newRow);

		var messageLogCount = parseInt(Homey.manager('settings').get('myMessageLogCount'));
		if(!messageLogCount) {
			messageLogCount = 5000;
		}
		var sendRealTimeEvent = 'newMySensorMessage';

		if (this.messageLog.length > messageLogCount) {
			this.messageLog.splice(0, this.messageLog.length - messageLogCount);
			sendRealTimeEvent = 'reloadMySensorMessage';
		}
		
		Homey.manager('settings').set('mySensorMessageLog', this.messageLog);
		Homey.manager('api').realtime(sendRealTimeEvent, newRow);
	}

	debugLog(message, data) {
		if (!this.showDebugLog) {
			return;
		}

		if (!this.debugLogArr) {
			this.debugLogArr = [];
		}

		if (!data) {
			data = null;
		}

		this.debugLogArr.push({datetime: new Date(), message: message, data: data});

		if (this.debugLogArr.length > 100) {
			this.debugLogArr.splice(0, 1);
		}

		var d = new Date().getTime();
		var dString = new Date(d).toISOString().replace(/T/, ' ').replace(/\..+/, '');

		if (data == null) {
			console.log(dString+" MYS", message);
		} else {
			console.log(dString+" MYS", message, data);
		};
	}
}
module.exports = MySensors;
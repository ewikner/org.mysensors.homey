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
	    var self = this;
		var localCapabilities = {}

	    for(var capabilityname in this.getDeviceClassesCapabilities()){
	    	for (var i = 0; i < 255; i++) {
	    		var newCapabilityname = capabilityname+'.'+i;
	    		if(localCapabilities[newCapabilityname] == null) {
		            localCapabilities[newCapabilityname] = this.getSetCapability(newCapabilityname);
		        }
	    	}
	    }
	    return localCapabilities;
	}

	getDeviceClassesCapabilities() {
	    return deviceClasses.capabilities;
	}

	initPair(data, callback ) {
		var self = this;
		self.debugLog('initPair - self');
	    var devices = [];

	    for(var nodeId in this.nodes){
	        var node = this.getNodeById(nodeId);
	        if(node !== undefined) {
	            if(!node.getIsAdded()) {
	            	devices.push(node);
	            }
	        }
	    }
	    var extra = {};
	    extra.mysensors_types = mysensorsProtocol.req_set;
	    extra.homey_capabilities = this.getDeviceClassesCapabilities();
	    callback( devices , extra);
	}

	addedNodePair(data, callback) {
		var self = this;
		self.debugLog('addedNodePair')
		var node = this.getNodeById(data.nodeId);
	    if(node !== undefined) {
	        node.saveNodeFromPair(data, function(err) {
	            if(err == null) {
	            	node.addNodeToDevice();
				    var node_device = node.createDeviceObject();


				    self.debugLog('addedNodePair', util.inspect(node_device, false, null))
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
		var self = this;
	    self.debugLog('addedDevicePair')

	    var device_data = node_device.data;
	    var node = this.getNodeById(device_data.nodeId);
	    node.triggerSensorValue();

	    callback("done");
	}

	renameDevice(device_data, new_name) {
		var self = this;
	    self.debugLog('renameDevice')
	    var node = this.getNodeById(device_data.nodeId);
	    if(node != null) {
	        node.setName(new_name);
	    }
	}

	deletedDevice(device_data) {
		var self = this;
	    self.debugLog('deletedDevice')
	    var node = this.getNodeById(device_data.nodeId);
	    node.deleteNode();
	}

	getSetCapability(capability) {
	    var self = this;
	    
	    var specialFunctions = {
	        get: function( device_data, callback ){
	            //self.debugLog("+++SPECIAL GET "+capability)
	            //self.debugLog(device_data);
	            
	            var node = self.getNodeById(device_data.nodeId);
	            if( typeof callback == 'function' ) {
	            	var value = null;
	            	if((node.getShowBatteryLevel()) && (capability == 'measure_battery.0')) {
		                value = node.getBatteryLevel();
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
	            	//self.debugLog("value = "+value)
		            //self.debugLog("SPECIAL GET+++ "+capability)
	                callback( null, value);
	            }
	        },

	        set: function( device_data, value, callback ) {
	            if( typeof callback == 'function' ) {
	                var node = self.getNodeById(device_data.nodeId);
	                if((node.getShowBatteryLevel()) && (capability == 'measure_battery.0')) {
	                    node.setShowBatteryLevel(value);
	                } else {
	                    var sensor = node.getSensorByCapability(capability);
	                    if(sensor != null) {
	                        sensor.setPayloadFromCapabilitySet(value);
	                    } else {
	                        self.debugLog("sensor = null");
	                    }
	                }
	                callback( null, value );
	            }
	        }
	    };
	    return specialFunctions;
	}

	startConnectionTimer() {
		var self = this;
	    if(this.connectionTimer !== null) {
	        clearInterval(this.connectionTimer);
	    }
	    
	    this.connectionTimer = setInterval(() => {
	    	this.connectToGateway();
	    }, 60000 );
	}

	connectToGateway() {
		var self = this;
		this.settings = Homey.manager('settings').get('mys_settings');

	    if(this.settings && (self.gwIsConnected === false)) {
	        if((this.settings.gatewayType == 'mqtt') && 
	            (this.settings.mqtt_host != '') && 
	            (this.settings.mqtt_port != '') && 
	            (this.settings.publish_topic != '') && 
	            (this.settings.subscribe_topic != '')) {

	            self.debugLog("----MQTT-----")

	            self.gwSplitChar = '/';
	            self.topicPublish = self.settings.publish_topic;
	            self.topicSubscribe = self.settings.subscribe_topic;
	            self.debugLog('mqtt://'+self.settings.mqtt_host+':'+self.settings.mqtt_port);
	            self.gwClient = mqtt.connect('mqtt://'+self.settings.mqtt_host+':'+self.settings.mqtt_port);
	     
	            self.gwClient.on('connect', function () {
	                if(self.gwClient != null) {
	                    clearInterval(self.connectionTimer);
	                    self.gwIsConnected = true;
	                    self.debugLog('MQTT connected');
	                    self.gwClient.subscribe(self.topicPublish + '/#');
	                    self.gwClient.subscribe(self.topicSubscribe + '/#');
	                    self.sendDiscoverMessage();
	                    self.startDiscoverTimer();
	                }
	              
	            }).on('message', function (topic, data) {
	                var dataTopic = topic.substr(topic.indexOf('/')+1);
	                var mqttTopic = topic.substr(0,topic.indexOf('/'));

	                switch(mqttTopic) {
	                    case self.topicPublish:
	                        //self.debugLog('publish');
	                        break;
	                    case self.topicSubscribe:
	                        self.handleMessage(self.decodeMessage(dataTopic+'/'+data, self.gwSplitChar))
	                        break;
	                }
	            }).on('reconnect', function () {
	                self.debugLog('MQTT reconnect');
	            }).on('close', function () {
	                self.debugLog('MQTT disconnected');
	                self.startConnectionTimer();
	                self.gwClient = null;
	                self.gwIsConnected = false;
	            }).on('error', function (error) {
	                self.debugLog('MQTT error');
	                self.debugLog(error);
	            });

	        } else if((this.settings.gatewayType == 'ethernet') && 
	                (this.settings.ethernet_host != '') && 
	                (this.settings.ethernet_port != '') && 
	                (this.settings.timeout != '')) {

	            self.debugLog("----Ethernet-----")
	            this.gwSplitChar = ';';
	            this.gwClient = net.Socket();
	            this.gwClient.connect(this.settings.ethernet_port, this.settings.ethernet_host);
	            if(this.settings.timeout === undefined) {
	                this.settings.timeout = 60000;
	            }
	            this.gwClient.setEncoding('ascii');
	            this.gwClient.setTimeout(parseInt(this.settings.timeout));
	            this.gwClient.on('connect', function() {
	                clearInterval(this.connectionTimer);
	                this.gwIsConnected = true;
	                self.debugLog('Ethernet connected');
	                self.sendDiscoverMessage();
	                self.startDiscoverTimer();
	                
	            }).on('data', function(data) {
	                var dataArr = data.split('\n');
	                dataArr.forEach(function(data_str, index) {
	                    self.handleMessage(self.decodeMessage(data_str, self.gwSplitChar))
	                });
	            }).on('end', function() {
	                self.debugLog('Ethernet disconnected');
	                self.startConnectionTimer();
	                this.gwClient = null;
	                this.gwIsConnected = false;
	            }).on('error', function(err) {
	                self.debugLog('Ethernet error'+err.message);
	                self.startConnectionTimer();
	                this.gwClient = null;
	                this.gwIsConnected = false;
	            });
	        } else {
	            self.debugLog("----TEST-----")
	        }
	    } else {
	        self.startConnectionTimer();
	    }
	}

	startDiscoverTimer() {
		var self = this;
	    if(this.discoverTimer !== null) {
	        clearInterval(this.discoverTimer);
	    }
	    this.discoverTimer = setInterval(() => {
	    	this.sendDiscoverMessage();
	    }, 3600000 );
	}

	sendDiscoverMessage() {
		var self = this;
	    self.debugLog("sendDiscoverMessage")
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
		var self = this;

	    node.on('nodeSensorSendSetMessage', (message, callback) => {
	        self.debugLog('MySensors.js nodeSensorSendSetMessage', message)
	        self.sendSetMessage(message, callback);
	    })

	    node.on('nodeSensorTriggerValue', (eventName, sensor, nodeDeviceData, value) => {
	        self.debugLog('MySensors.js nodeSensorTriggerValue ', eventName)
	        self.debugLog(value);
	        self.emit('nodeSensorTriggerValue', eventName, sensor, nodeDeviceData, value);
	    })

	    node.on('nodeSensorRealtimeUpdate', (nodeDeviceData, capability, payload) => {
	        self.emit('nodeSensorRealtimeUpdate', nodeDeviceData, capability, payload);
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
		var self = this;
		self.debugLog('-- SEND sendSetMessage ----');

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
		var self = this;
	    self.debugLog('-- SEND DATA ----');
	    if(messageObj.subType == '') {
	        var node = this.getNodeById(messageObj.nodeId);
	        var sensor = node.getSensorById(messageObj.sensorId);

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

	    var returnObj = mysensorsProtocol.encodeMessage(messageObj, this.gwSplitChar, this.settings.gatewayType);
	    var dataStr = returnObj.returnMessage;
	    self.mySensorMessageLog(returnObj.messageObj);

	    self.debugLog(dataStr);

	    if(this.gwClient != null) {
	        if(this.settings.gatewayType == 'mqtt') {
	            self.debugLog("SENDDATA to MQTT "+this.settings.publish_topic+'/'+dataStr.message_str);
	            this.gwClient.publish(this.settings.publish_topic+'/'+dataStr.message_str, dataStr.payload);
	        } else if(this.settings.gatewayType == 'ethernet') {
	            self.debugLog("SENDDATA to ethernet "+dataStr);
	            this.gwClient.write(dataStr + "\n");
	        }
	    }
	}

	getNextID(message) {
		var self = this;
	    self.debugLog('-- getNextID ----');
	    if(this.last_node_id <= this.NODE_SENSOR_ID-1) {
	        this.last_node_id++;
	    }

	    self.sendData({
	        nodeId: message.nodeId,
	        sensorId: message.sensorId,
	        messageType: message.messageType,
	        ack: 0,
	        subType: 'I_ID_RESPONSE',
	        payload: this.last_node_id
	    });
	}

	decodeMessage(data_str, gwSplitChar) {
		var self = this;
	    return mysensorsProtocol.decodeMessage(data_str, gwSplitChar);
	}

	actionSet(args, callback) {
		var self = this;

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
		var self = this;
		var node = this.nodes[nodeId];

	    if(node === undefined) {
	        if(this.last_node_id < nodeId) {
	            this.last_node_id = nodeId;
	        }
	        var node = new Node(nodeId);
	        self.addMySensorsEventListener(node);

	        this.nodes[node.nodeId] = node;
	    }
	    
	    return node;
	}

	receivedAckMessage(messageObj) {
		var self = this;

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
		var self = this;
	    if(message) {
	        self.mySensorMessageLog(message);
	        self.debugLog('----- handleMessage -------')
	        switch(message.messageType) {
	            case 'presentation': self.handlePresentation(message); break;
	            case 'set': self.handleSet(message); break;
	            case 'req': self.handleReq(message); break;
	            case 'internal': self.handleInternal(message); break;
	            case 'stream': self.handleStream(message); break;
	        }
	    }
	}

	handlePresentation(message) {
		var self = this;
	    self.debugLog('----- presentation -------')
	    var node = self.getNodeById(message.nodeId);
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
		var self = this;
		self.debugLog('----- set -------')

		var handleThisMessage = true;
		if(message.ack == 1) {
			handleThisMessage = this.receivedAckMessage(message)
	    }

	    if(handleThisMessage) {
		    var node = self.getNodeById(message.nodeId);
		    var sensor = node.getSensorFromMessage(message);

		    if(sensor != null) {
		        sensor.payloadType = message.subType;
		        sensor.setPayloadFromMessage(message.payload);
		    }
	    }
	}

	handleReq(message) {
		var self = this;
	    self.debugLog('----- req -------')
	    var node = self.getNodeById(message.nodeId);
	    var sensor = node.getSensorFromMessage(message);

	    if(sensor != null) {
	    	self.sendData({
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
		var self = this;
	    self.debugLog('----- internal -------')
	    self.debugLog('subType: '+message.subType)
	    switch(message.subType) {
	        case 'I_BATTERY_LEVEL': 
	            var node = self.getNodeById(message.nodeId);
	            node.setBatteryLevel(message.payload);
	            break;
	        case 'I_TIME':
	            self.sendData({
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
	                var node = self.getNodeById(message.nodeId);
	                node.setVersion(message.payload);
	            }
	            break;
	        case 'I_ID_REQUEST': 
	            self.getNextID(message);
	            break;
	        case 'I_ID_RESPONSE': break;
	        case 'I_INCLUSION_MODE': break;
	        case 'I_CONFIG': 
	            self.sendData({
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
	            var node = self.getNodeById(message.nodeId);
	            node.setSketchName(message.payload);
	            break;
	        case 'I_SKETCH_VERSION': 
	            var node = self.getNodeById(message.nodeId);
	            node.setSketchVersion(message.payload);
	            break;
	        case 'I_REBOOT': break;
	        case 'I_GATEWAY_READY': break;
	        case 'I_REQUEST_SIGNING': break;
	        case 'I_GET_NONCE': break;
	        case 'I_GET_NONCE_RESPONSE': break;
	        case 'I_HEARTBEAT': break;
	        	self.sendData({
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
	            // self.sendData({
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
		var self = this;
	    self.debugLog('----- stream -------')
	    self.debugLog('Not implemented')
	}

	mySensorMessageLog(message) {
		var self = this;
		if (!this.messageLog) {
			this.messageLog = [];
		}

		self.debugLog(message);

		Homey.manager('api').realtime('mySensorMessageLog', message);

		this.messageLog.push(message);
		Homey.manager('settings').set('mySensorMessageLog', this.messageLog);
	}

	debugLog(message, data) {
		var self = this;
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
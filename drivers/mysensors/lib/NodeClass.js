'use strict';
const events = require('events');
const fileExists = require('file-exists');
var deviceClasses = require('./deviceclasses.json');
var mysensorsProtocol = require('./mysensorsProtocol');
var Sensor = require('./SensorClass.js');

class Node extends events.EventEmitter {
	constructor(nodeId) {
		super();

		this.id = nodeId;
		this.nodeId = nodeId;
		this.type = '';
		this.batteryLevel = 100;
		this.showBatteryLevel = false;
		this.lastSeen = '0000-00-00 00:00:00';
		this.showLastSeen = false;
		this.sketchName = '';
		this.sketchVersion = '';
		this.version = '';
		this.name = 'Node '+this.nodeId;
		this.isAdded = false;
		this.sendAck = false;
		this.sensors = {};
	}

	getIsAdded() {
		return this.isAdded;
	}

	setName(value) {
		this.name = value;
	}

	getId() {
		return this.nodeId;
	}

	getType() {
		return this.type;
	}

	getShowBatteryLevel() {
		return this.showBatteryLevel;
	}

	setShowBatteryLevel(value) {
		this.showBatteryLevel = value;
	}

	setBatteryLevel(value) {
		this.batteryLevel = this.parseBatteryLevel(value);
		if (this.showBatteryLevel) {
			this.triggerNodeSensorRealtimeUpdate("measure_battery.255", this.batteryLevel);
		}
	}

	getBatteryLevel() {
		return this.batteryLevel;
	}

	parseBatteryLevel(value) {
		var newValue = null;
		if(value != '') {
            value = Number(value);
            if(value > 100) {
                var divWith = 1;
                for (var i = 0; i < value.toString().length; i++) {
                    divWith = divWith+'0';
                }
                
                value = value/divWith;
            }
            if(value < 0) {
                value = 0;
            }
            value = value.toFixed(2);
            newValue = parseFloat(value);
        }
        return newValue;
	}

	getShowLastSeen() {
		return this.showLastSeen;
	}

	setShowLastSeen(value) {
		this.showLastSeen = value;
	}

	getLastSeen() {
		return this.lastSeen;
	}

	setLastSeen() {
		var date = new Date();

	    var hour = date.getHours();
	    hour = (hour < 10 ? "0" : "") + hour;

	    var min  = date.getMinutes();
	    min = (min < 10 ? "0" : "") + min;

	    var sec  = date.getSeconds();
	    sec = (sec < 10 ? "0" : "") + sec;

	    var year = date.getFullYear();

	    var month = date.getMonth() + 1;
	    month = (month < 10 ? "0" : "") + month;

	    var day  = date.getDate();
	    day = (day < 10 ? "0" : "") + day;

		this.lastSeen = ""+year + "-" + month + "-" + day + " " + hour + ":" + min + ":" + sec;
		
		if (this.showLastSeen) {
			this.triggerNodeSensorRealtimeUpdate("mysensors_lastseen.255", this.lastSeen.toString());
		}
	}

	setVersion(value) {
		this.version = value;
	}

	setSketchName(value) {
		this.sketchName = value;
	}

	setSketchVersion(value) {
		this.sketchVersion = value;
	}

	saveNodeFromPair(data, callback) {
		this.name = data.name;
		this.showLastSeen = data.showLastSeen;
		this.showBatteryLevel = data.showBatteryLevel;
		this.sendAck = data.sendAck;

		var sensorArr = data.sensors;
		for(var sensorId in sensorArr) {
			var sensorData = sensorArr[sensorId];
			var sensor = this.getSensorById(sensorId);
			if(sensorData != null) {
				if((sensor == null) || (sensorData.new == true)) {
					sensor = this.newSensor(sensorData.sensorId, sensorData.sensorType);
				} else {
					sensor.setSensorType(sensorData.sensorType);
				}
				sensor.setTitle(sensorData.title);
				sensor.setCapability(sensorData.capability);

			} else {
				delete this.sensors[sensorId];
			}
		}

		callback(null);
	}

	getSensors() {
		return this.sensors;
	}

	getNumSensors() {
		var numSensors = 0;
		for(var sensorId in this.sensors) {
			numSensors++
		}
		return numSensors;
	}

	getSensorById(sensorId) {
		var sensor = this.sensors[sensorId];
		return sensor;
	}

	getSensorByCapability(capability) {
		var returnSensor = null;
		for(var sensorId in this.sensors) {
			var sensor = this.getSensorById(sensorId);
			var sesnorCapa = sensor.getCapability();
			if(sesnorCapa == capability) {
				returnSensor = sensor;
			}
		}
		return returnSensor;
	}

	getSensorFromMessage(message) {
	    var sensor = this.getSensorById(message.sensorId);

	    if(sensor === undefined) {
            var subType = message.subType;
            if(subType === undefined) {
                subType = message.sensorType;
            }
            sensor = this.newSensor(message.sensorId,subType);
	    }
	    return sensor;
	}

	addSensorsEventListener(sensor) {
		sensor.on('sensorSendSetMessage', (message, callback) => {
			if(this.isAdded) {
				message.nodeId = this.nodeId;
				if(this.sendAck) {
					message.ack = 1;
				}
				this.emit('nodeSensorSendSetMessage', message, callback);
			}
		})

		sensor.on('sensorTriggerValue', (eventName, sensor, value) => {
			if(this.isAdded) {
				var node_device_data = this.getDeviceDataObject();
				this.emit('nodeSensorTriggerValue', eventName, sensor, node_device_data, value);
			}
		})

		sensor.on('getNodeDeviceData', (callback) => {
			if(this.isAdded) {
				var node_device_data = this.getDeviceDataObject();
				callback(node_device_data);
			}
		})

		sensor.on('sensorRealtimeUpdate', (capability, payload) => {
			if(this.isAdded) {
				this.triggerNodeSensorRealtimeUpdate(capability, payload);
			}
		})
		
	}

	triggerNodeSensorRealtimeUpdate(capability, payload) {
		var node_device_data = this.getDeviceDataObject();
		this.emit('nodeSensorRealtimeUpdate', node_device_data, capability, payload);
	}

	newSensor(sensorId, sensorType) {

		var sensor = new Sensor(sensorId, sensorType);
		this.addSensorsEventListener(sensor);

		return this.sensors[sensor.sensorId] = sensor;
	}

	getSensorClasses() {
		return 'other';
	}

	triggerSensorValue() {
		for(var sensorId in this.sensors) {
			var sensor = this.getSensorById(sensorId);
			sensor.triggerRealtimeUpdate();
		}
	}

	getDeviceClassesCapabilities() {
		return Object.assign(deviceClasses.capabilities, Homey.manifest.capabilities)
	}

	getSensorDeviceObj() {
		var sensorCapabilities = [];
		var capabilitiesOptions = {}
		var _iconDir = "./drivers/mysensors/assets/icons/";

		for(var sensorId in this.sensors) {
			var sensor = this.getSensorById(sensorId);
			var sensorTitle = sensor.getTitle();
			var sesnorCapa = sensor.getCapability();
			if(sesnorCapa != null) {
				sensorCapabilities.push(sesnorCapa);
				var optionsObj = {}

				if(sensorTitle != '') {
					optionsObj.title = sensorTitle
				}
				capabilitiesOptions[sesnorCapa] = optionsObj
			}
		}

		if (this.showBatteryLevel) {
			sensorCapabilities.push("measure_battery.255");
		}
		if (this.showLastSeen) {
			sensorCapabilities.push("mysensors_lastseen.255");
		}

		var capabilitiesArr = sensorCapabilities;

		var mobileObj = {
			components: [
				{
					id: "icon",
					capabilities: []
				}
			]
		}

		// number, boolean or string
		var sensorObj = {};
		sensorObj.id = "sensor";
		sensorObj.capabilities = [];
		sensorObj.options = { icons: {}}

		// number
		var batteryObj = {};
		batteryObj.id = "battery";
		batteryObj.capabilities = [];

		// number
		var sliderObj = {};
		sliderObj.id = "slider";
		sliderObj.capabilities = [];
		sliderObj.options = { icons: {}}

		// enum
		var pickerObj = {};
		pickerObj.id = "picker";
		pickerObj.capabilities = [];
		pickerObj.options = { icons: {}}

		var colorObj = {};
		colorObj.id = "color";
		colorObj.capabilities = [];
		colorObj.options = { icons: {}}

		var thermostatObj = {};
		thermostatObj.id = "thermostat";
		thermostatObj.capabilities = [];
		thermostatObj.options = { icons: {}}

		for(var key in capabilitiesArr) {
			var capability = capabilitiesArr[key];
			var capabilityType = null;
			if((capability.indexOf('.') > -1)) {
	            capabilityType = capability.substring(0, capability.indexOf('.'))
	        }

	        var deviceCapabilityObj = this.getDeviceClassesCapabilities();
	        var deviceCapability = deviceCapabilityObj[capabilityType];
	        var iconPath = _iconDir+capabilityType+".svg";
	        if(!fileExists(iconPath)) {
	        	iconPath = null;
	        }

	        switch(capabilityType) {
	        	case 'measure_battery':
	        		batteryObj.capabilities.push(capability);
	        		break;
	        	case 'onoff':
					var toggleObj = {};
					toggleObj.id = "toggle";
					toggleObj.capabilities = [];
					toggleObj.options = { icons: {}}
					toggleObj.options.showTitle = true
		        	if(iconPath != null) {
			        	toggleObj.options.icons[capability] = iconPath;
			        }
					toggleObj.capabilities.push(capability);
					mobileObj.components.push(toggleObj);
	        		break;
	        	case 'dim':
		        	if(iconPath != null) {
		        		sliderObj.options.icons[capability] = iconPath;
		        	}
					sliderObj.capabilities.push(capability);

					break;
				case 'light_hue':
				case 'light_saturation':
				case 'light_temperature':
					if(iconPath != null) {
						colorObj.options.icons[capability] = iconPath;
					}
					colorObj.capabilities.push(capability);
					break;
				case 'target_temperature':
					if(iconPath != null) {
						thermostatObj.options.icons[capability] = iconPath;
					}
					thermostatObj.capabilities.push(capability);
					break;
				case 'light_mode':
				case 'vacuumcleaner_state':
				case 'thermostat_mode':
				case 'homealarm_state':
				case 'lock_mode':
				case 'windowcoverings_state':
					if(iconPath != null) {
						pickerObj.options.icons[capability] = iconPath;
					}
					var pickerValues = {};
					for(var capaValue in deviceCapability.values) {
						let pickValue = deviceCapability.values[capaValue];
						pickerValues[pickValue.id] = pickValue.id

					}
					pickerObj.options.values = pickerValues
					pickerObj.capabilities.push(capability);
					break;
				default: // sensor
					if(iconPath != null) {
						sensorObj.options.icons[capability] = iconPath;
					}
					sensorObj.capabilities.push(capability);
	        }

		}

		if(batteryObj.capabilities.length > 0) {
			mobileObj.components.push(batteryObj);
		}
		if(sensorObj.capabilities.length > 0) {
			mobileObj.components.push(sensorObj);
		}
		if(sliderObj.capabilities.length > 0) {
			mobileObj.components.push(sliderObj);
		}
		if(colorObj.capabilities.length > 0) {
			mobileObj.components.push(colorObj);
		}
		if(thermostatObj.capabilities.length > 0) {
			mobileObj.components.push(thermostatObj);
		}
		if(pickerObj.capabilities.length > 0) {
			mobileObj.components.push(pickerObj);
		}

		var returnObj = {}
		returnObj.capabilities = capabilitiesArr;
		returnObj.mobile = mobileObj;
		returnObj.capabilitiesOptions = capabilitiesOptions;
		return returnObj;
	}

	addNodeToDevice() {
		this.isAdded = true;
	}

	deleteNode() {
		this.isAdded = false;
	}

	getSensorsDeviceObject() {
		var sensors_device = {};
		for(var sensorId in this.sensors) {
			var sensor = this.getSensorById(sensorId);
			sensors_device[sensorId] = sensor.getDeviceDataObject();
		}
		return sensors_device;
	}

	getDeviceDataObject() {
		var node_device_data = {
			id: this.nodeId,
			nodeId: this.nodeId,
			//type: this.type,
			//batteryLevel: this.batteryLevel,
			showLastSeen: this.showLastSeen,
			showBatteryLevel: this.showBatteryLevel,
			//sketchName: this.sketchName,
			//sketchVersion: this.sketchVersion,
			//version: this.version,
			//name: this.name,
			//isAdded: this.isAdded,
			sendAck: this.sendAck,
			sensors: this.getSensorsDeviceObject()
		}
		return node_device_data;
	}

	setDeviceDataObject(device_data) {
		this.id = device_data.id;
		this.nodeId = device_data.nodeId;
		//this.type = device_data.type;
		//this.batteryLevel = device_data.batteryLevel;
		this.showLastSeen = device_data.showLastSeen;
		this.showBatteryLevel = device_data.showBatteryLevel;
		//this.sketchName = device_data.sketchName;
		//this.sketchVersion = device_data.sketchVersion;
		//this.version = device_data.version;
		//this.name = device_data.name;
		//this.isAdded = device_data.isAdded;
		this.sendAck = device_data.sendAck;

		var deviceSensors = device_data.sensors;
		for(var sensorId in deviceSensors) {
			var sensor_data = deviceSensors[sensorId];
			var sensor = this.getSensorById(sensorId);
			if(sensor == null) {
				sensor = this.newSensor(sensor_data.sensorId, sensor_data.sensorType);
			}
			sensor.setDeviceDataObject(sensor_data);
		}
	}

	createDeviceObject() {
		var node_device_data = this.getDeviceDataObject();
		var sensor_device_object = this.getSensorDeviceObj();

		var node_device = {
			data: node_device_data,
			name: this.name,
			class: this.getSensorClasses(),
			capabilities: sensor_device_object.capabilities,
			capabilitiesOptions: sensor_device_object.capabilitiesOptions,
			mobile: sensor_device_object.mobile
		};

		return node_device;
	}
}

module.exports = Node;
'use strict';
const events = require('events');
const fileExists = require('file-exists');
var deviceClasses = require('./deviceclasses.json');
var mysensorsProtocol = require('./mysensorsProtocol');
var Sensor = require('./SensorClass.js');

class Node extends events.EventEmitter {
	constructor(nodeId) {
		super();

		this.nodeId = nodeId;
		this.type = '';
		this.batteryLevel = 100;
		this.showBatteryLevel = false;
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
		this.showBatteryLeve = value;;
	}

	setBatteryLevel(value) {
		this.batteryLevel = value;
	}

	getBatteryLevel() {
		return this.batteryLevel;
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
		var self = this;

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
		var self = this;
		sensor.on('sensorSendSetMessage', function (message, callback) {
			if(self.isAdded) {
				message.nodeId = self.nodeId;
				if(self.sendAck) {
					message.ack = 1;
				}
				self.emit('nodeSensorSendSetMessage', message, callback);
			}
		})

		sensor.on('sensorTriggerValue', function (eventName, sensor, value) {
			if(self.isAdded) {
				var node_device_data = self.getDeviceDataObject();
				self.emit('nodeSensorTriggerValue', eventName, sensor, node_device_data, value);
			}
		})

		sensor.on('getNodeDeviceData', function (callback) {
			if(self.isAdded) {
				var node_device_data = self.getDeviceDataObject();
				callback(node_device_data);
			}
		})

		sensor.on('sensorRealtimeUpdate', function (capability, payload) {
			if(self.isAdded) {
				self.triggerNodeSensorRealtimeUpdate(capability, payload);
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
		var self = this;
		return 'other';
	}

	triggerSensorValue() {
		for(var sensorId in this.sensors) {
			var sensor = this.getSensorById(sensorId);
			sensor.triggerRealtimeUpdate();
		}

		if (this.showBatteryLevel) {
			var batteryPayload = this.batteryLevel;
			this.triggerNodeSensorRealtimeUpdate("measure_battery.0", batteryPayload);
		}
	}

	getSensorCapabilities() {
		var sensorCapabilities = [];
		for(var sensorId in this.sensors) {
			var sensor = this.getSensorById(sensorId);
			var sesnorCapa = sensor.getCapability();
			if(sesnorCapa != null) {
				sensorCapabilities.push(sesnorCapa);
			}
		}

		if (this.showBatteryLevel) {
			sensorCapabilities.push("measure_battery.0");
		}

		return sensorCapabilities;
	}

	getSensorMobileObj() {
		//var _iconDir = "./drivers/mysensors/assets/icons/";
		var _iconDir = "drivers/mysensors/assets/icons/";
		var capabilitiesArr = this.getSensorCapabilities();

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

		// boolean
		var toggleObj = {};
		toggleObj.id = "toggle";
		toggleObj.capabilities = [];
		toggleObj.options = { icons: {}}

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
	        var deviceCapability = deviceClasses.capabilities[capabilityType];
	        var iconPath = _iconDir+capabilityType+".svg";
	        if(!fileExists(iconPath)) {
	        	iconPath = null;
	        }
	        switch(capabilityType) {
	        	case 'onoff':
		        	if(iconPath != null) {
			        	toggleObj.options.icons[capability] = iconPath;
			        }
					toggleObj.capabilities.push(capability);
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

		if(sensorObj.capabilities.length > 0) {
			mobileObj.components.push(sensorObj);
		}
		if(toggleObj.capabilities.length > 0) {
			mobileObj.components.push(toggleObj);
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

		return mobileObj;
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
			nodeId: this.nodeId,
			//type: this.type,
			//batteryLevel: this.batteryLevel,
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
		this.nodeId = device_data.nodeId;
		//this.type = device_data.type;
		//this.batteryLevel = device_data.batteryLevel;
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
		var node_device = {
			data: node_device_data,
			name: this.name,
			class: this.getSensorClasses(),
			capabilities: this.getSensorCapabilities(),
			mobile: this.getSensorMobileObj()
		};

		return node_device;
	}
}

module.exports = Node;
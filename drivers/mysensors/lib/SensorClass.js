'use strict';
const events = require('events');
var deviceClasses = require('./deviceclasses.json');
var mysensorsProtocol = require('./mysensorsProtocol');

class Sensor extends events.EventEmitter {
    constructor(sensorId, sensorType) {
        super();

        //console.log("------- NEW SENSORClass ID = "+sensorId+" -------")
        this.sensorId = sensorId;
        this.sensorType = sensorType;
        this.title = '';
        this.payload = '';
        this.payloadType = '';
        this.lastSet = '';
        this.lastSeen = '';
        this.capability = null;
        this.class = 'other';

    }

    getTitle() {
        return this.title;
    }
    setTitle(value) {
        this.title = value;
    }

    getAutoCompleteObj() {
        var obj = {
                name: this.sensorId+" "+this.sensorType,
                sensorId: this.sensorId
            };
        return obj;
    }
    getSensorType() {
        return this.sensorType;
    }

    setSensorType(value) {
        if(value.charAt(0) == 'V') {
            this.sensorType = value;
        }
    }

    getDeviceDataObject() {
        var sensor_device = {
            sensorId: this.sensorId,
            sensorType: this.sensorType,
            title: this.title,
            // payload: this.payload,
            // payloadType: this.payloadType,
            // lastSet: this.lastSet,
            // lastSeen: this.lastSeen,
            capability: this.capability,
            class: this.class
        };
        return sensor_device;
    }

    setDeviceDataObject(device_data) {
        this.sensorId = device_data.sensorId;
        this.sensorType = device_data.sensorType;
        this.title = device_data.title;
        // this.payload = device_data.payload;
        // this.payloadType = device_data.payloadType;
        // this.lastSet = device_data.lastSet;
        // this.lastSeen = device_data.lastSeen;
        this.class = device_data.class;
        this.setCapability(device_data.capability);
    }

    getCapabilityType() {
        var capability = this.capability;
        if((capability != null) && (capability.indexOf('.') > -1)) {
            capability = capability.substring(0, capability.indexOf('.'))
        }
        return capability;
    }

    getCapability() {
        return this.capability;
    }

    setCapability(newCapability){
        if(newCapability != null) {
            if(newCapability.indexOf('.') === -1) {
                newCapability = newCapability +'.'+this.sensorId;
            }
            this.capability = newCapability;
        }
    }

    getDefaultCapability() {
        var defaultCapability = mysensorsProtocol.getCapabilities(this.sensorType);

        if(defaultCapability != null) {
            if(defaultCapability.sub_type != '') {
               return defaultCapability.sub_type;
            }
        }
        return null;
    }
    getPayload() {
        return this.payload;
    }

    setPayload(value) {
        this.lastSet = Date.now();
        this.lastSeen = Date.now();
        this.payload = value;

        this.triggerRealtimeUpdate();
    }

    triggerRealtimeUpdate() {
        this.emit('sensorRealtimeUpdate', this.getCapability(), this.parsePayload()); 
    }

    sendSetMessage(payload, callback) {
        this.emit('sensorSendSetMessage', {
            sensorId: this.sensorId,
            messageType: 'set',
            ack: 0,
            subType: this.payloadType,
            payload: payload
        }, callback);
    }

    setPayloadFromMessage(value) {
        var old_payload = this.payload;
        this.setPayload(value);
        var payload_parse = this.parsePayload();
        if(old_payload != this.payload) {
            this.emit('sensorTriggerValue', 'value_changed', this, payload_parse);
        }
        
        switch(payload_parse) {
            case true:
                this.emit('sensorTriggerValue', 'value_on', this, payload_parse);
                break;
            case false:
                this.emit('sensorTriggerValue', 'value_off', this, payload_parse);
                break;
        }
    }

    setPayloadFromCapabilitySet(value) {
        this.sendSetMessage(value, (result) => {
            if(result) {
                this.setPayload(value);
            } else {
                //console.log("not ack response ")
            }
        });
    }

    setPayloadFromAction(value) {
        this.sendSetMessage(value, (result) => {
            if(result) {
                this.setPayload(value);
                return true;
            } else {
                //console.log("not ack response ")
            }
        });
    }
    getDeviceClassesCapabilities() {
        return Object.assign(deviceClasses.capabilities, Homey.manifest.capabilities)
    }

    parsePayload() {
        var value = this.payload;
        var newValue = null;
        var thisCapability = this.getCapabilityType()
        if(thisCapability == null) {
            var defaultCapability = this.getDefaultCapability();
            if(defaultCapability == null) {
                return null;
            }
            this.setCapability(defaultCapability);
            thisCapability = this.getCapabilityType()
        }

        var deviceCapabilityObj = this.getDeviceClassesCapabilities();
        var capability = deviceCapabilityObj[thisCapability];
        if(capability) {
            switch(capability.type) {
                case 'number':
                    if(value != '') {
                        value = Number(value);
                        if("max" in capability) {
                            if(value > capability.max) {
                                var divWith = 1;
                                for (var i = 0; i < value.toString().length; i++) {
                                    divWith = divWith+'0';
                                }
                                
                                value = value/divWith;
                            }
                        }
                        if(("min" in capability)) {
                            if(value < capability.min) {
                                value = capability.min;
                            }
                        }
                        if(("decimals" in capability)) {
                            if(capability.decimals > 0) {
                                value = value.toFixed(capability.decimals);
                            }
                        }
                        newValue = parseFloat(value);
                    }
                    break;
                case 'enum': 
                    if(("values" in capability)) {
                        var enumValues = capability.values;
                        var enumValue = null;
                        for (var i = 0; i < enumValues.length; i++) {
                            var eValue = enumValues[i];
                            if(value == eValue.id) {
                                enumValue = eValue.id;
                                break;
                            }
                        }
                    }
                    newValue = enumValue; 
                    break;
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
        return newValue;
    }
}

module.exports = Sensor;
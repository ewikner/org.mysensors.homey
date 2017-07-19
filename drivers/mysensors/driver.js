var MySensors = require('./lib/MySensors.js');

var mySensor = new MySensors();
var showDebugLog = true;
var debugLogArr = [];

function debugLog(message, data) {
	if (!showDebugLog) {
		return;
	}

	if (!debugLogArr) {
		debugLogArr = [];
	}

	if (!data) {
		data = null;
	}

	debugLogArr.push({datetime: new Date(), message: message, data: data});

	if (debugLogArr.length > 100) {
		debugLogArr.splice(0, 1);
	}

	var d = new Date().getTime();
	var dString = new Date(d).toISOString().replace(/T/, ' ').replace(/\..+/, '');
	if (data == null) {
		console.log(dString+" DRIVER", message);
	} else {
		console.log(dString+" DRIVER", message, data);
	};
}

var self = module.exports = {
    init : (devices_data, callback) => {
	    debugLog('init');

	    showDebugLog = Homey.manager('settings').get('mys_show_debug');
	    if(showDebugLog === undefined) {
	    	showDebugLog = true;
	    }
	    mySensor.setShowDebugLog(showDebugLog);
	    self.generateCapabilitiesGetSet();
	    self.createHomeyListener();

	    devices_data.forEach((device_data) => {
	        self.getDeviceInfo(device_data);
	    }) 

	    mySensor.connectToGateway();

	    callback()
	},


	generateCapabilitiesGetSet : () => {
		debugLog(" IN generateCapabilitiesGetSet")
	    module.exports.capabilities = mySensor.generateCapabilitiesGetSet();
	},

	createHomeyListener : function() {
		module.exports.added = ( device_data, callback ) => {
		    debugLog( "ADDED ",device_data );
		    callback( null, true );
		}

	    mySensor.on('nodeSensorRealtimeUpdate', (nodeDeviceData, capability, payload) => {
	    	module.exports.realtime(nodeDeviceData, capability, payload, (err, success) => {
	            if (err) {
	                debugLog('! Realtime ERR 1: ',err);
	                debugLog('! Realtime ERR 2: ',capability); 
	                debugLog('! Realtime ERR 3: ',nodeDeviceData);
	            }
	        });
	    })

	    mySensor.on('nodeSensorTriggerValue', (eventName, sensor, nodeDeviceData, value) => {
	    	debugLog('! nodeSensorTriggerValue');
	    	var tokens = {}
	    	Homey.manager('flow').triggerDevice(eventName, tokens, { 'sensorId': sensor.sensorId  }, nodeDeviceData);
	    })

	    Homey.manager('settings').on('set', (varName) => {
	    	if(varName == 'mys_settings') {
	    		mySensor.settingsSet();
	    	}
	    	if(varName == 'mys_show_debug') {
	    		showDebugLog = Homey.manager('settings').get('mys_show_debug');
	    		mySensor.setShowDebugLog(showDebugLog);
	    	}
	    })

	    Homey.manager('flow').on('trigger.value_changed.sensorId.autocomplete', this.triggerAutocomplete.bind(this))
	    Homey.manager('flow').on('trigger.value_changed', this.triggerValue.bind(this))
	    
	    Homey.manager('flow').on('trigger.value_on.sensorId.autocomplete', this.triggerAutocomplete.bind(this))
	    Homey.manager('flow').on('trigger.value_on', this.triggerValue.bind(this))
	    
	    Homey.manager('flow').on('trigger.value_off.sensorId.autocomplete', this.triggerAutocomplete.bind(this))
	    Homey.manager('flow').on('trigger.value_off', this.triggerValue.bind(this))
	    
	    Homey.manager('flow').on('condition.value_is.sensorId.autocomplete', this.triggerAutocomplete.bind(this))
	    Homey.manager('flow').on('condition.value_is', this.conditionValueIs.bind(this));
	    
	    Homey.manager('flow').on('condition.onoff.sensorId.autocomplete', this.triggerAutocomplete.bind(this))
	    Homey.manager('flow').on('condition.onoff', this.conditionOnOff.bind(this));
	    
	    Homey.manager('flow').on('action.set_text.sensorId.autocomplete', this.triggerAutocomplete.bind(this))
	    Homey.manager('flow').on('action.set_text', this.actionSet.bind(this))
	    
	    Homey.manager('flow').on('action.set_number.sensorId.autocomplete', this.triggerAutocomplete.bind(this))
	    Homey.manager('flow').on('action.set_number', this.actionSet.bind(this))
	    
	    Homey.manager('flow').on('action.set_onoff.sensorId.autocomplete', this.triggerAutocomplete.bind(this))
	    Homey.manager('flow').on('action.set_onoff', this.actionSet.bind(this))
	},

	conditionValueIs: (callback, args) => {
		debugLog('FLOW = condition.value_is', args)
        var node = mySensor.getNodeById(args.device.nodeId);
        if(node !== null) {
	        var sensor = node.getSensorById(args.sensorId.sensorId);
	        if(sensor !== null) {
		        callback( null, (args.value_is === sensor.parsePayload()) );
		    } else {
		    	callback( null, false);
		    }
	    } else {
	    	callback( null, false);
	    }
	},

	conditionOnOff: (callback, args) => {
		debugLog('FLOW = condition.onoff', args)
        var testValue = args.value_is;
        switch(testValue) {
            case 'true':
                testValue = true;
                break;
            case 'false':
                testValue = false;
                break;
        }

        var node = mySensor.getNodeById(args.device.nodeId);

        if(node !== null) {
	        var sensor = node.getSensorById(args.sensorId.sensorId);
	        if(sensor !== null) {
		        callback( null, (testValue === sensor.parsePayload()) );
		    } else {
		    	callback( null, false);
		    }
	    } else {
	    	callback( null, false);
	    }
	},

	triggerValue: (callback, args, state) => {
		debugLog('FLOW = triggerValue args', args)
		debugLog('FLOW = triggerValue state', state)
		if(args.sensorId.sensorId == state.sensorId) {
        	callback( null, true );
        } else {
        	callback( null, false );
        }
	},

	actionSet: ( callback, args) => {
		debugLog('FLOW = actionSet', args)
		mySensor.actionSet(args, (result ) => {
            callback( null, result );
        })
	},

	triggerAutocomplete: ( callback, args) => {
    	var resultArray = [];
    	var nodeId;
    	if(args.args.device.hasOwnProperty('data')) {
    		nodeId = args.args.device.data.nodeId;
    	} else {
    		nodeId = args.args.device.nodeId;
    	}
    	var node = mySensor.getNodeById(nodeId);
    	var sensors = node.getSensors();

    	if( Object.keys( sensors ).length < 1 ) {
			return callback( new Error("No Sensors") );
    	}

    	Object.keys(sensors).forEach((sensorId) => {
			var sensor = sensors[sensorId];
			resultArray.push(sensor.getAutoCompleteObj());
		});

    	resultArray = resultArray.filter(( resultArrayItem ) => {
			return resultArrayItem.name.toLowerCase().indexOf( args.query.toLowerCase() ) > -1;
		});
        callback( null, resultArray );
	},

	getDeviceInfo : (device_data) => {
	    var node = mySensor.getNodeById(device_data.nodeId);
	    
	    // Check if old version
	    if(device_data.hasOwnProperty('sensorId')) {
	    	var sensors_device_arr = {};
	    	var sensor_device = {
	            sensorId: device_data.sensorId,
	            sensorType: device_data.sensorType,
	            capability: null,
	            class: 'other'
	        };
	       	sensors_device_arr[sensor_device.sensorId] = sensor_device;
	    	var new_device_data = {
	    		nodeId: device_data.nodeId,
	    		showBatteryLevel: false,
	    		sendAck: false,
	    		sensors: sensors_device_arr
	    	}
	    }
	    node.setDeviceDataObject(device_data);
	    node.addNodeToDevice();

	    module.exports.getName( device_data, ( err, nameValue) => {
	        node.setName(nameValue);
	    })
	},

	pair : (socket) => {
	    socket.on('initPair', ( data, callback ) => {
	        mySensor.initPair( data, callback );
	    });

	    socket.on('addedNodePair', (data, callback) => {
	        mySensor.addedNodePair(data, callback);
	    });

	    socket.on('addedDevicePair', (device, callback) => {
	        mySensor.addedDevicePair(device, callback);
	    });
	},

	renamed : ( device_data, new_name ) => {
	    mySensor.renameDevice( device_data, new_name );
	},

	deleted : ( device_data ) => {
	     mySensor.deletedDevice( device_data );
	},

	settings : (device_data, newSettingsObj, oldSettingsObj, changedKeysArr, callback) => {
	  // TODO
	  debugLog('settings');
	  callback(null, true)
	},

	testFunctions : (func) => {
	    return mySensor[func].apply(mySensor, Array.prototype.slice.call(arguments, 1));
	}
}
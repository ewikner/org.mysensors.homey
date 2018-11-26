var MySensors = require('./lib/MySensors.js');
const Homey = require('homey');

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

class MySensorDriver extends Homey.Driver {

	onInit(){
		debugLog('init');

		this.devices = [];

	    showDebugLog = Homey.ManagerSettings.get('mys_show_debug');
	    if(showDebugLog === undefined) {
	    	showDebugLog = true;
	    }
		
		mySensor.setShowDebugLog(showDebugLog);
	    this.generateCapabilitiesGetSet();
	    this.createHomeyListener();
		
		var devices = this.getDevices();

	    devices.forEach((device) => {
			this.getDeviceInfo(device);
		}) 

		mySensor.connectToGateway();

	}

	onPair(socket) {
		console.log('pairing');

	    socket.on('initPair', ( data, callback ) => {
	        mySensor.initPair( data, callback );
	    });

	    socket.on('addedNodePair', (data, callback) => {
	        mySensor.addedNodePair(data, callback);
	    });

	    socket.on('addedDevicePair', (device, callback) => {
	        mySensor.addedDevicePair(device, callback);
	    });
    }

	onPairListDevices( data, callback ) {
        this.log("list devices");

        var devices = [];

	//	console.log(data);
	}

	generateCapabilitiesGetSet() {
		debugLog(" IN generateCapabilitiesGetSet")
	    this.capabilities = mySensor.generateCapabilitiesGetSet();
	}

	createHomeyListener(){

		console.log('setup listener');

		//cards 
		// triggers

		this.trigger = {};
		this.trigger.value_changed = new Homey.FlowCardTriggerDevice("value_changed").register();
		this.trigger.value_changed.registerRunListener(this.triggerValue.bind(this));

		this.trigger.value_changed
			.getArgument('sensorId')
			.registerAutocompleteListener(this.onTriggerAutocomplete.bind(this));

		this.trigger.value_on = new Homey.FlowCardTriggerDevice("value_on").register();
		this.trigger.value_on.registerRunListener(this.triggerValue.bind(this));

		this.trigger.value_on
			.getArgument('sensorId')
			.registerAutocompleteListener(this.onTriggerAutocomplete.bind(this));

		this.trigger.value_off = new Homey.FlowCardTriggerDevice("value_off").register();
		this.trigger.value_off.registerRunListener(this.triggerValue.bind(this));

		this.trigger.value_off
			.getArgument('sensorId')
			.registerAutocompleteListener(this.onTriggerAutocomplete.bind(this));

		this.trigger.value_updated = new Homey.FlowCardTriggerDevice("value_updated").register();
		this.trigger.value_updated.registerRunListener(this.triggerValue.bind(this));

		this.trigger.value_updated
			.getArgument('sensorId')
			.registerAutocompleteListener(this.onTriggerAutocomplete.bind(this));
	

		// conditions

		this.condition = {};	
		this.condition.value_is = new Homey.FlowCardCondition('value_is').register();
		this.condition.value_is.registerRunListener(this.conditionValueIs.bind(this));
		this.condition.value_is
			.getArgument('sensorId')
			.registerAutocompleteListener(this.onTriggerAutocomplete.bind(this));

		this.condition.onoff = new Homey.FlowCardCondition('onoff').register();
		this.condition.onoff.registerRunListener(this.conditionOnOff.bind(this));
		this.condition.onoff
			.getArgument('sensorId')
			.registerAutocompleteListener(this.onTriggerAutocomplete.bind(this));

		
		// action
		this.action = {}
		this.action.set_text = new Homey.FlowCardAction('set_text').register();
		this.action.set_text.registerRunListener(this.actionSet.bind(this));
		this.action.set_text
			.getArgument('sensorId')
			.registerAutocompleteListener(this.onTriggerAutocomplete.bind(this));

		this.action.set_number = new Homey.FlowCardAction('set_number').register();
		this.action.set_number.registerRunListener(this.actionSet.bind(this));
		this.action.set_number
			.getArgument('sensorId')
			.registerAutocompleteListener(this.onTriggerAutocomplete.bind(this));

		this.action.set_onoff = new Homey.FlowCardAction('set_onoff').register();
		this.action.set_onoff.registerRunListener(this.actionSet.bind(this));
		this.action.set_onoff
			.getArgument('sensorId')
			.registerAutocompleteListener(this.onTriggerAutocomplete.bind(this));


		
	    mySensor.on('nodeSensorRealtimeUpdate', (nodeDeviceData, capability, payload) => {
			var dev = this.devices.find(dev => dev.getData().nodeId===nodeDeviceData.nodeId);

			if ( typeof dev !== 'undefined' && dev )
			{
				dev.setCapabilityValue(capability,payload);
			}

	    	// module.exports.realtime(dev, capability, payload, (err, success) => {
	        //     if (err) {
	        //         debugLog('! Realtime ERR 1: ',err);
	        //         debugLog('! Realtime ERR 2: ',capability); 
	        //         debugLog('! Realtime ERR 3: ',nodeDeviceData);
	        //     }
	        // });
	    })

	    mySensor.on('nodeSensorTriggerValue', (eventName, sensor, nodeDeviceData, value) => {
			debugLog('! nodeSensorTriggerValue');
			try {
				var dev = this.devices.find(dev => dev.getData().nodeId===nodeDeviceData.nodeId);
				var tokens = {}

				switch(eventName) {
					case 'value_updated':
						this.trigger.value_updated.trigger( dev, tokens, { 'sensorId': sensor.sensorId  } )
						break;
					case 'value_changed':
						this.trigger.value_changed.trigger( dev, tokens, { 'sensorId': sensor.sensorId  } )
						break;
					case 'value_on':
						this.trigger.value_on.trigger( dev, tokens, { 'sensorId': sensor.sensorId  } )
						break;
					case 'value_off':
						this.trigger.value_off.trigger( dev, tokens, { 'sensorId': sensor.sensorId  } )
						break;
				}				
			} catch (error) {
				debugLog('Cannot set Trigger value', sensor.sensorId);
			}
	    	// Homey.manager('flow').triggerDevice(eventName, tokens, { 'sensorId': sensor.sensorId  }, nodeDeviceData);
		})
		
		Homey.ManagerSettings.on('set', (varName) => {
	    	if(varName == 'mys_settings') {
	    		mySensor.settingsSet();
	    	}
	    	if(varName == 'mys_show_debug') {
	    		showDebugLog = Homey.ManagerSettings.get('mys_show_debug');
	    		mySensor.setShowDebugLog(showDebugLog);
	    	}
		})
		

	    // Homey.manager('flow').on('trigger.value_changed.sensorId.autocomplete', this.triggerAutocomplete.bind(this))
	    // Homey.manager('flow').on('trigger.value_changed', this.triggerValue.bind(this))
	    
	    // Homey.manager('flow').on('trigger.value_on.sensorId.autocomplete', this.triggerAutocomplete.bind(this))
	    // Homey.manager('flow').on('trigger.value_on', this.triggerValue.bind(this))
	    
	    // Homey.manager('flow').on('trigger.value_off.sensorId.autocomplete', this.triggerAutocomplete.bind(this))
	    // Homey.manager('flow').on('trigger.value_off', this.triggerValue.bind(this))
	    
	    // Homey.manager('flow').on('condition.value_is.sensorId.autocomplete', this.triggerAutocomplete.bind(this))
	    // Homey.manager('flow').on('condition.value_is', this.conditionValueIs.bind(this));
	    
	    // Homey.manager('flow').on('condition.onoff.sensorId.autocomplete', this.triggerAutocomplete.bind(this))
	    // Homey.manager('flow').on('condition.onoff', this.conditionOnOff.bind(this));
	    
	    // Homey.manager('flow').on('action.set_text.sensorId.autocomplete', this.triggerAutocomplete.bind(this))
	    // Homey.manager('flow').on('action.set_text', this.actionSet.bind(this))
	    
	    // Homey.manager('flow').on('action.set_number.sensorId.autocomplete', this.triggerAutocomplete.bind(this))
	    // Homey.manager('flow').on('action.set_number', this.actionSet.bind(this))
	    
	    // Homey.manager('flow').on('action.set_onoff.sensorId.autocomplete', this.triggerAutocomplete.bind(this))
	    // Homey.manager('flow').on('action.set_onoff', this.actionSet.bind(this))
	}


	triggerValue( args, state, callback ) {
		debugLog('FLOW = trigger')
		if(args.sensorId.sensorId == state.sensorId) {
        	callback( null, true );
        } else {
        	callback( null, false );
        }
	}

	onTriggerAutocomplete(query, args) {

		console.log(args);

		var data = args.device.getData();
    	var resultArray = [];
    	var nodeId = data.nodeId;
    	var node = mySensor.getNodeById(nodeId);
    	var sensors = node.getSensors();

    	if( Object.keys( sensors ).length < 1 ) {
			return Promise.reject('No Sensors');
    	}

    	Object.keys(sensors).forEach((sensorId) => {
			var sensor = sensors[sensorId];
			resultArray.push(sensor.getAutoCompleteObj());
		});

    	resultArray = resultArray.filter(( resultArrayItem ) => {
			return resultArrayItem.name.toLowerCase().indexOf( query.toLowerCase() ) > -1;
		});
		return Promise.resolve(resultArray);
	}

	// condition functions
	conditionValueIs(args,state)  {
			//debugLog('FLOW = condition.value_is', args)		
			var data = args.device.getData();
			var node = mySensor.getNodeById(data.nodeId);
			if(node !== null) {
				var sensor = node.getSensorById(args.sensorId.sensorId);
				if(sensor !== null) {
					var pl = sensor.parsePayload();
					if ( typeof pl !== 'undefined' && pl )
					{
						return Promise.resolve(args.value_is === pl.toString());
					}
					else {
						return Promise.resolve(false);
					}
				} else {
					return Promise.resolve(false);
				}
			} else {
				return Promise.resolve(false);
			}
	}

	
	conditionOnOff(args,state)  {
		//debugLog('FLOW = condition.onoff', args)
		var testValue = args.value_is;
		switch(testValue) {
			case 'true':
				testValue = true;
				break;
			case 'false':
				testValue = false;
				break;
		}

		var data = args.device.getData();
		var node = mySensor.getNodeById(data.nodeId);

		if(node !== null) {
			var sensor = node.getSensorById(args.sensorId.sensorId);
			if(sensor !== null) {
				return Promise.resolve(testValue === sensor.parsePayload());
			} else {
				return Promise.resolve(false);
			}
		} else {
			return Promise.resolve(false);
		}
	}

	actionSet( args, state, callback ) {
		mySensor.actionSet(args, (result ) => {
            callback( null, result );
        })
	}

	getDeviceInfo(device) {
		//console.log(device_data.getName());

		var data = device.getData();
		var node = mySensor.getNodeById(data.nodeId);

		if(data.hasOwnProperty('sensorId')) {
		   console.log('************* OLD DATA');		
		}

		node.setDeviceDataObject(data);		
		node.setName(device.getName());
		node.addNodeToDevice();
	}

}

module.exports = MySensorDriver;


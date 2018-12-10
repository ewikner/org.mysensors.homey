'use strict';

const Homey = require('homey');

class MySensorDevice extends Homey.Device {

    // this method is called when the Device is inited
    onInit() {

        // let device = this; // We're in a Device instance
        // let tokens = {};
        // let state = {};

        this._driver = this.getDriver();
        this._driver.devices.push(this);

        this.log('device init');
        var name = this.getName();
        this.log('name:', name);
        // this.log('class:', this.getClass());

        // this.trigger = {};
		// this.trigger.value_changed = new Homey.FlowCardTriggerDevice("value_changed").register();
		// this.trigger.value_changed.registerRunListener(( args, state ) => {
        //     console.log("trugger device")
    
        // })

		// this.trigger.value_changed
		// 	.getArgument('sensorId')
		// 	.registerAutocompleteListener(this._driver.onTriggerAutocomplete.bind(this._driver));


        if (name=='Buiten sensor') {
            console.log('Set value');
            var caps = this.getCapabilities()
            caps.forEach(c => {
                console.log(c);
                console.log(this.getCapabilityValue(c));
                console.log(this.error);
                this.setCapabilityValue(c,1);
                console.log(this.error);
            });

            console.log(this.hasCapability('measure_luminance.1'));
            
            try { this.setCapabilityValue('measure_luminance.1', 100.0)} catch(e) { this.log(e.stack) }

            console.log(this.error);
        }
       

        // register a capability listener
       // this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this))
    }

    // this method is called when the Device is added
    onAdded() {
        this.log('device added');
    }

    // this method is called when the Device is deleted
    onDeleted() {
        this.log('device deleted');
    }

    updateNode(capability, payload)
    {
        console.log('$$$$$$$$$$$$$$update: ' + this.getName());
        this.setCapabilityValue('measure_luminance.1', 100.0).catch(e => this.log('test je')); 

       
    }

    // // this method is called when the Device has requested a state change (turned on or off)
    // onCapabilityOnoff( value, opts, callback ) {

    //     // ... set value to real device

    //     // Then, emit a callback ( err, result )
    //     callback( null );

    //     // or, return a Promise
    //     return Promise.reject( new Error('Switching the device failed!') );
    // }

}

module.exports = MySensorDevice;
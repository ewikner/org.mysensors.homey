'use strict';

const Homey = require('homey');

class MySensorDevice extends Homey.Device {

    // this method is called when the Device is inited
    async onInit() {

        // let device = this; // We're in a Device instance
        // let tokens = {};
        // let state = {};

        this._driver = await this._getDriver();
        this._driver.devices.push(this);

        var name = this.getName();
        this.log(`Init device ${name}`);
    }

    // this method is called when the Device is added
    onAdded() {
        this.log('device added');
    }

    // this method is called when the Device is deleted
    onDeleted() {

        console.log('device deleted');
        // need to remove node!!
        this._driver.removeDevice(this); 
    }

    // Get a (ready) instance of the driver.
    async _getDriver() {
        return new Promise(resolve => {
        let driver = this.getDriver();
        driver.ready(() => resolve(driver));
        });
    }

}

module.exports = MySensorDevice;
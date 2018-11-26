"use strict";

const Homey = require('homey');

class MySensorsApp extends Homey.App {
  
  onInit() {
    this.log('App Starting...');
  }
  
}

module.exports = MySensorsApp; 
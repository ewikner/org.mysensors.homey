'use strict';

const Homey = require('homey');
const Logger = require('./captureLogs.js');

class MySensorsApp extends Homey.App {

	onInit() {
		this.log(`${Homey.manifest.id} V${Homey.manifest.version} is running...`);
		// try {
		// 		require('inspector').open(9229, '0.0.0.0', false);
		// } catch (error) {
		// 	console.log(error);
		// }

		// Not the nices way but it seems some memory not to be cleared hopefully Garbage Collection will fix this 03.02.2019 MTi
		this.GarbageColletorInterval = setInterval(() => {
			if (global.gc) {
				global.gc();
				console.log('GC Called');
			} else {
				console.warn('No GC hook!');
			}
		}, 15 * 60000); // every 15 min

		this.logger = new Logger('mySensors', 400);

		// global crash handling
		process.on('uncaughtException', (err) => {
			this.error(`Caught exception: ${err}\n`);
			this.logger.saveLogs();
		});

		process.on('unhandledRejection', (reason, p) => {
			this.error(`Unhandled Rejection at:${p}, reason:, ${reason}`);
			this.logger.saveLogs();
		});

		Homey
			.on('unload', () => {
				this.log('app unload called');
				// save logs to persistant storage
				this.logger.saveLogs();
			})
			.on('memwarn', () => {
				this.log('memwarn!');
				this.logger.saveLogs();
				if (global.gc) {
					global.gc();
					console.log('GC Called');
				} else {
					console.warn('No GC hook!');
				}
			})
			.on('cpuwarn', () => {
				this.log('cpu warning');
				this.logger.saveLogs();
			});
	}

	//  stuff for frontend API
	deleteLogs() {
		return this.logger.deleteLogs();
	}

	getLogs() {
		return this.logger.logArray;
	}


}

module.exports = MySensorsApp;

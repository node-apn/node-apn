"use strict";

const Debug = require("debug");
const EventEmitter = require("events");

// TODO: Abstract into a `logger` object
let debug = Debug("apn");
let trace = Debug("apn:trace");

module.exports = function(dependencies) {
	const config = dependencies.config;
	const EndpointManager = dependencies.EndpointManager;

	function Connection (options) {
		if(false === (this instanceof Connection)) {
			return new Connection(options);
		}

		this.config = config(options);
		this.endpointManager = new EndpointManager(this.config);

		EventEmitter.call(this);
	}

	Connection.prototype = Object.create(EventEmitter.prototype);

	Connection.prototype.pushNotification = function pushNotification(notification, recipients) {
    return Promise.all([new Promise( resolve => {
	    const stream = this.endpointManager.getStream();
	    stream.headers({
	      ":scheme": "https",
	      ":method": "POST",
	      ":authority": this.config.address,
	      ":path": "/3/device/" + recipients,
	      "apns-topic": notification.topic,
	      "content-length": 19,
	    });

	    stream.on("headers", headers => {
	    	resolve({ "device": recipients });
	    })
	    stream.write(notification.compile());
	    stream.end();
    })]).then( responses => {
    	return [responses, []];
    });
	};

	return Connection;
};


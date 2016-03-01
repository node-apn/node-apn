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

		new EndpointManager(config(options));

		EventEmitter.call(this);
	}

	Connection.prototype = Object.create(EventEmitter.prototype);

	Connection.prototype.pushNotification = function (notification, recipients) {
	  let body = notification.compile();
	  // this.loadCredentials().then( (credentials) => {
	  //   var endpoint = new Endpoint({
	  //     "address": this.options.address,
	  //     "port": 443,
	  //     "cert": credentials.cert,
	  //     "key": credentials.key
	  //   });

	  //   endpoint.on("connected", () => {
	  //     console.log("streaming")
	  //     let stream = endpoint.createStream();
	  //     let headers = {
	  //       ":scheme": "https",
	  //       ":method": "POST",
	  //       ":authority": this.options.address,
	  //       ":path": "/3/device/" + recipients[0],

	  //       "content-length": body.length
	  //     }

	  //     stream.on("data", () => {
	  //       console.log("data");
	  //     });
	  //     stream.headers(headers)
	  //     stream.write(body)
	  //     stream.end()
	  //     console.log("written")
	  //   });
	  // });
	};

	return Connection;
};


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
		const self = this;
		function send(notification, device) {
			return new Promise( resolve => {
				const stream = self.endpointManager.getStream();
				stream.setEncoding("utf8");

				stream.headers({
					":scheme": "https",
					":method": "POST",
					":authority": self.config.address,
					":path": "/3/device/" + device,
					"content-length": 19,
				});

				let status, response;
				stream.on("headers", headers => {
					console.log("headers", headers);
					status = headers[":status"];
				});

				stream.on("data", (data) => {
					response = JSON.parse(data);
				});

				stream.on("end", () => {
					if (status == 200) {
						resolve({ device });
					} else {
						resolve({ device, status, response });
					}
				});
				stream.write(notification.compile());
				stream.end();
				console.log("written");
			});
		}

		return Promise.all([send(notification, recipients)]).then( responses => {
			let success = [];
			let failure = [];

			responses.forEach( response => {
				if (response.status) {
					failure.push(response);
				} else {
					success.push(response);
				}
			});
			return [success, failure];
		});
	};

	return Connection;
};


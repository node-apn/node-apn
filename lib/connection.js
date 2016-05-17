"use strict";
const EventEmitter = require("events");
const Promise = require("bluebird");
const extend = require("./util/extend");

module.exports = function(dependencies) {
	const config = dependencies.config;
	const EndpointManager = dependencies.EndpointManager;

	class Connection extends EventEmitter {

		constructor (options) {
			super();

			this.config = config(options);
			this.endpointManager = new EndpointManager(this.config);
			this.endpointManager.on("error", (args) => {
				if (this.listeners("error").length > 0) {
					this.emit("error", args);
				}
			});

			this.endpointManager.on("wakeup", () => {
				while (this.queue.length > 0) {
					const stream = this.endpointManager.getStream();
					if (!stream) {
						return;
					}
					const resolve = this.queue.shift();
					resolve(stream);
				}
			});

			this.queue = [];
		}

		pushNotification (notification, recipients) {

			const notificationHeaders = notification.headers();
			const notificationBody = notification.compile();

			const send = device => {
				return new Promise( resolve => {
					const stream = this.endpointManager.getStream();
					if (!stream) {
						this.queue.push(resolve);
					} else {
						resolve(stream);
					}
				}).then( stream => {
					return new Promise ( resolve => {
						stream.setEncoding("utf8");

						stream.headers(extend({
							":scheme": "https",
							":method": "POST",
							":authority": this.config.address,
							":path": "/3/device/" + device
						}, notificationHeaders));

						let status, responseData = "";
						stream.on("headers", headers => {
							status = headers[":status"];
						});

						stream.on("data", data => {
							responseData = responseData + data;
						});

						stream.on("end", () => {
							if (status === "200") {
								resolve({ device });
							} else {
								const response = JSON.parse(responseData);
								resolve({ device, status, response });
							}
						});
						stream.write(notificationBody);
						stream.end();
					});
				});
			};

			if (!Array.isArray(recipients)) {
				recipients = [recipients];
			}

			return Promise.all( recipients.map(send) ).then( responses => {
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
	}

	return Connection;
};


"use strict";

const EventEmitter = require("events");

module.exports = function(dependencies) {

	const Endpoint = dependencies.Endpoint;

	function EndpointManager() {
		EventEmitter.call(this);

		this._endpoints = [];
	}

	EndpointManager.prototype = Object.create(EventEmitter.prototype);

	EndpointManager.prototype.getStream = function getStream() {
		if (!this._currentConnection) {
			const endpoint = new Endpoint();
			this._currentConnection = endpoint;

			endpoint.once("connect", () => {
				this.emit("wakeup");
			});

			endpoint.on("wakeup", () => {
				if (endpoint.availableStreamSlots > 0) {
					this.emit("wakeup");
				}
			});
		}
	}

	return EndpointManager;
}
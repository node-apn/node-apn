"use strict";

const EventEmitter = require("events");

module.exports = function(dependencies) {

	const Endpoint = dependencies.Endpoint;

	function EndpointManager(config) {
		EventEmitter.call(this);

		this._endpoint = null;
		this._config = config;
	}

	EndpointManager.prototype = Object.create(EventEmitter.prototype);

	EndpointManager.prototype.getStream = function getStream() {
		if (this._endpoint && this._endpoint.availableStreamSlots > 0) {
			return this._endpoint.createStream();
		}

		if (!this._currentConnection && !this._endpoint) {
			const endpoint = new Endpoint(this._config);
			this._currentConnection = endpoint;

			endpoint.once("connect", () => {
				this._endpoint = endpoint;
				delete this._currentConnection;
			});

			endpoint.on("wakeup", () => {
				if (endpoint.availableStreamSlots > 0) {
					this.emit("wakeup");
				}
			});
		}
		return null;
	}

	return EndpointManager;
}
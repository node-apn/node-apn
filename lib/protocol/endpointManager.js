"use strict";

const EventEmitter = require("events");

module.exports = function(dependencies) {

	const Endpoint = dependencies.Endpoint;

	class EndpointManager extends EventEmitter {

		constructor (config) {
			super();
			this._endpoint = null;
			this._config = config;
		}

		getStream () {
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

				endpoint.on("error", (err) => {
					delete this._endpoint;
					delete this._currentConnection;
					this.emit("error", err);
				});

				endpoint.on("wakeup", () => {
					if (endpoint.availableStreamSlots > 0) {
						this.emit("wakeup");
					}
				});
			}
			return null;
		};

	}

	return EndpointManager;
};

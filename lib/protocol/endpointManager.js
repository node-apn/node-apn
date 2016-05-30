"use strict";

const EventEmitter = require("events");

module.exports = function(dependencies) {

  const Endpoint = dependencies.Endpoint;

  function EndpointManager(config) {
    EventEmitter.call(this);

    this._endpoints = [];
    this._config = config;
    this._connectionFailures = 0;
  }

  EndpointManager.prototype = Object.create(EventEmitter.prototype);

  EndpointManager.prototype.getStream = function getStream() {
    let endpoint = this._endpoints[0];
    if (endpoint && endpoint.availableStreamSlots > 0) {
      return endpoint.createStream();
    }

    if (!this._currentConnection) {
      const endpoint = new Endpoint(this._config);
      this._currentConnection = endpoint;

      endpoint.once("connect", () => {
        this._endpoints.push(endpoint);
        this._connectionFailures = 0;
        delete this._currentConnection;
      });

      endpoint.on("error", err => {
        endpoint.destroy();
        this._currentConnection = null;
        this._connectionFailures += 1;
        if (this._connectionFailures == 3) {
          this.emit("error", new Error("Connection failed"));
        }
      });

      endpoint.on("wakeup", () => {
        if (endpoint.availableStreamSlots > 0) {
          this.emit("wakeup");
        }
      });
    }
    return null;
  };

  return EndpointManager;
};

"use strict";

const EventEmitter = require("events");
const VError = require("verror");

module.exports = function(dependencies) {

  const Endpoint = dependencies.Endpoint;

  function EndpointManager(config) {
    EventEmitter.call(this);

    this._endpoints = [];
    this._endpointIndex = 0;
    this._config = config || {};
    this._connectionFailures = 0;
  }

  EndpointManager.prototype = Object.create(EventEmitter.prototype);

  EndpointManager.prototype.getStream = function getStream() {
    for (let i=0; i < this._endpoints.length; i++) {
      this._endpointIndex += 1;
      this._endpointIndex %= this._endpoints.length;

      if (this._endpoints[this._endpointIndex].availableStreamSlots > 0) {
        return this._endpoints[this._endpointIndex].createStream();
      }
    }

    if (!this.connectionRetryLimitReached()) {
      this.createEndpoint();
    }

    return null;
  };

  EndpointManager.prototype.connectionRetryLimitReached = function connectionRetryLimitReached() {
    if (!this._config.connectionRetryLimit) {
      return false;
    }

    return this._connectionFailures >= this._config.connectionRetryLimit;
  };

  EndpointManager.prototype.createEndpoint = function createEndpoint() {
    if (this._currentConnection || this._endpoints.length >= this._config.maxConnections) {
      return;
    }

    const endpoint = new Endpoint(this._config);
    this._currentConnection = endpoint;

    endpoint.once("connect", () => {
      this._endpoints.push(endpoint);
      this._connectionFailures = 0;
      delete this._currentConnection;
    });

    endpoint.on("error", err => {
      endpoint.destroy();
      this.removeEndpoint(endpoint);

      if (this._currentConnection === endpoint) {
        this._currentConnection = null;
        if(this._endpoints.length === 0) {
          this._connectionFailures += 1;
          if (this.connectionRetryLimitReached()) {
            this.emit("error", new VError(err, "endpoint error"));
            this._connectionFailures = 0;
          }
        }
      }
      
      this.emit("wakeup");
    });

    endpoint.on("end", () => {
      this.removeEndpoint(endpoint);
      this.emit("wakeup");
    });

    endpoint.on("wakeup", this.emit.bind(this, "wakeup"));
  };

  EndpointManager.prototype.removeEndpoint = function removeEndpoint(endpoint) {
      let index = this._endpoints.indexOf(endpoint);
      if (index > -1) {
        this._endpoints.splice(index, 1);
      }
  };

  EndpointManager.prototype.shutdown = function shutdown() {
    for(let endpoint of this._endpoints) {
      endpoint.close();
    }

    if (this._currentConnection) {
      this._currentConnection.close();
      delete this._currentConnection;
    }
  };

  return EndpointManager;
};

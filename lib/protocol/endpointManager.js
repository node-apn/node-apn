"use strict";

var EventEmitter = require("events");
var VError = require("verror");

module.exports = function (dependencies) {

  var Endpoint = dependencies.Endpoint;

  function EndpointManager(config) {
    EventEmitter.call(this);

    this._endpoints = [];
    this._endpointIndex = 0;
    this._config = config || {};
    this._connectionFailures = 0;
  }

  EndpointManager.prototype = Object.create(EventEmitter.prototype);

  EndpointManager.prototype.getStream = function getStream() {
    for (var i = 0; i < this._endpoints.length; i++) {
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
    var _this = this;

    if (this._currentConnection || this._endpoints.length >= this._config.maxConnections) {
      return;
    }

    var endpoint = new Endpoint(this._config);
    this._currentConnection = endpoint;

    endpoint.once("connect", function () {
      _this._endpoints.push(endpoint);
      _this._connectionFailures = 0;
      delete _this._currentConnection;
    });

    endpoint.on("error", function (err) {
      endpoint.destroy();
      _this.removeEndpoint(endpoint);

      if (_this._currentConnection === endpoint) {
        _this._currentConnection = null;
        if (_this._endpoints.length === 0) {
          _this._connectionFailures += 1;
          if (_this.connectionRetryLimitReached()) {
            _this.emit("error", new VError(err, "endpoint error"));
            _this._connectionFailures = 0;
          }
        }
      }

      _this.emit("wakeup");
    });

    endpoint.on("end", function () {
      _this.removeEndpoint(endpoint);
      _this.emit("wakeup");
    });

    endpoint.on("wakeup", this.emit.bind(this, "wakeup"));
  };

  EndpointManager.prototype.removeEndpoint = function removeEndpoint(endpoint) {
    var index = this._endpoints.indexOf(endpoint);
    if (index > -1) {
      this._endpoints.splice(index, 1);
    }
  };

  EndpointManager.prototype.shutdown = function shutdown() {
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = this._endpoints[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var endpoint = _step.value;

        endpoint.close();
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    if (this._currentConnection) {
      this._currentConnection.close();
      delete this._currentConnection;
    }
  };

  return EndpointManager;
};
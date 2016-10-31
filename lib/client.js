"use strict";

var VError = require("verror");
var extend = require("./util/extend");

module.exports = function (dependencies) {
  var config = dependencies.config;
  var EndpointManager = dependencies.EndpointManager;

  function Client(options) {
    var _this = this;

    this.config = config(options);

    this.endpointManager = new EndpointManager(this.config);
    this.endpointManager.on("wakeup", function () {
      while (_this.queue.length > 0) {
        var stream = _this.endpointManager.getStream();
        if (!stream) {
          return;
        }
        var resolve = _this.queue.shift();
        resolve(stream);
      }

      if (_this.shutdownPending) {
        _this.endpointManager.shutdown();
      }
    });

    this.endpointManager.on("error", function (err) {
      _this.queue.forEach(function (resolve) {
        resolve(Promise.reject(err));
      });

      _this.queue = [];
    });

    this.queue = [];
  }

  Client.prototype.write = function write(notification, device, count) {
    var _this2 = this;

    return this.getStream().then(function (stream) {
      var tokenGeneration = void 0,
          status = void 0,
          responseData = "";
      var retryCount = count || 0;

      stream.setEncoding("utf8");

      stream.on("headers", function (headers) {
        status = headers[":status"];
      });

      stream.on("data", function (data) {
        responseData = responseData + data;
      });

      var headers = extend({
        ":scheme": "https",
        ":method": "POST",
        ":authority": _this2.config.address,
        ":path": "/3/device/" + device
      }, notification.headers);

      if (_this2.config.token) {
        headers.authorization = "bearer " + _this2.config.token.current;
        tokenGeneration = _this2.config.token.generation;
      }

      stream.headers(headers);
      stream.write(notification.body);

      return new Promise(function (resolve) {
        stream.on("end", function () {
          if (status === "200") {
            resolve({ device: device });
          } else if (responseData !== "") {
            var response = JSON.parse(responseData);

            if (status === "403" && response.reason === "ExpiredProviderToken" && retryCount < 2) {
              _this2.config.token.regenerate(tokenGeneration);
              resolve(_this2.write(notification, device, retryCount + 1));
              return;
            }

            resolve({ device: device, status: status, response: response });
          } else {
            var error = new VError("stream ended unexpectedly");
            resolve({ device: device, error: error });
          }
        });

        stream.on("unprocessed", function () {
          resolve(_this2.write(notification, device));
        });

        stream.on("error", function (err) {
          var error = void 0;
          if (typeof err === "string") {
            error = new VError("apn write failed: %s", err);
          } else {
            error = new VError(err, "apn write failed");
          }
          resolve({ device: device, error: error });
        });

        stream.end();
      });
    }).catch(function (error) {
      return { device: device, error: error };
    });
  };

  Client.prototype.getStream = function getStream() {
    var _this3 = this;

    return new Promise(function (resolve) {
      var stream = _this3.endpointManager.getStream();
      if (!stream) {
        _this3.queue.push(resolve);
      } else {
        resolve(stream);
      }
    });
  };

  Client.prototype.shutdown = function shutdown() {
    if (this.queue.length > 0) {
      this.shutdownPending = true;
      return;
    }
    this.endpointManager.shutdown();
  };

  return Client;
};
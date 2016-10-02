"use strict";

const VError = require("verror");
const extend = require("./util/extend");

module.exports = function (dependencies) {
  const config          = dependencies.config;
  const EndpointManager = dependencies.EndpointManager;

  function Client (options) {
    this.config = config(options);

    this.endpointManager = new EndpointManager(this.config);
    this.endpointManager.on("wakeup", () => {
      while (this.queue.length > 0) {
        const stream = this.endpointManager.getStream();
        if (!stream) {
          return;
        }
        const resolve = this.queue.shift();
        resolve(stream);
      }

      if (this.shutdownPending) {
        this.endpointManager.shutdown();
      }
    });

    this.endpointManager.on("error", (err) => {
      this.queue.forEach((resolve) => {
        resolve(Promise.reject(err));
      });

      this.queue = [];
    });

    this.queue = [];
  }

  Client.prototype.write = function write (notification, device, count) {
    return this.getStream().then( stream => {
      let tokenGeneration, status, responseData = "";
      let retryCount = count || 0;

      stream.setEncoding("utf8");

      stream.on("headers", headers => {
        status = headers[":status"];
      });

      stream.on("data", data => {
        responseData = responseData + data;
      });

      let headers = extend({
        ":scheme": "https",
        ":method": "POST",
        ":authority": this.config.address,
        ":path": "/3/device/" + device,
      }, notification.headers);

      if (this.config.token) {
        headers.authorization = "bearer " + this.config.token.current;
        tokenGeneration = this.config.token.generation;
      }

      stream.headers(headers);
      stream.write(notification.body);

      return new Promise ( resolve => {
        stream.on("end", () => {
          if (status === "200") {
            resolve({ device });
          } else if (responseData !== "") {
            const response = JSON.parse(responseData);

            if (status === "403" && response.reason === "ExpiredProviderToken" && retryCount < 2) {
              this.config.token.regenerate(tokenGeneration);
              resolve(this.write(notification, device, retryCount + 1));
              return;
            }

            resolve({ device, status, response });
          } else {
            let error = new VError("stream ended unexpectedly");
            resolve({ device, error });
          }
        });

        stream.on("unprocessed", () => {
          resolve(this.write(notification, device));
        });

        stream.on("error", err => {
          let error;
          if (typeof err === "string") {
            error = new VError("apn write failed: %s", err);
          } else {
            error = new VError(err, "apn write failed");
          }
          resolve({ device, error });
        });

        stream.end();
      });
    }).catch( error => {
      return { device, error };
    });
  };

  Client.prototype.getStream = function getStream() {
    return new Promise( resolve => {
      const stream = this.endpointManager.getStream();
      if (!stream) {
        this.queue.push(resolve);
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
}

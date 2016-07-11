"use strict";
const EventEmitter = require("events");
const Promise = require("bluebird");
const extend = require("./util/extend");

module.exports = function(dependencies) {
  const config = dependencies.config;
  const EndpointManager = dependencies.EndpointManager;

  function Connection (options) {
    if(false === (this instanceof Connection)) {
      return new Connection(options);
    }

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
    });

    this.queue = [];

    EventEmitter.call(this);
  }

  Connection.prototype = Object.create(EventEmitter.prototype);

  Connection.prototype.pushNotification = function pushNotification(notification, recipients) {
    const builtNotification = {
      headers: notification.headers(),
      body:    notification.compile(),
    };

    if (!Array.isArray(recipients)) {
      recipients = [recipients];
    }

    return Promise.all( recipients.map(this._write.bind(this, builtNotification)) )
      .then( responses => {
      let sent = [];
      let failed = [];

      responses.forEach( response => {
        if (response.status) {
          failed.push(response);
        } else {
          sent.push(response);
        }
      });
      return {sent, failed};
    });
  };

  Connection.prototype._write = function _write(notification, device) {
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
          ":path": "/3/device/" + device,
        }, notification.headers));

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
        stream.write(notification.body);
        stream.end();
      });
    });
  }

  return Connection;
};


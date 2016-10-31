"use strict";

var EventEmitter = require("events");

module.exports = function (dependencies) {
  var Client = dependencies.Client;

  function Provider(options) {
    if (false === this instanceof Provider) {
      return new Provider(options);
    }

    this.client = new Client(options);

    EventEmitter.call(this);
  }

  Provider.prototype = Object.create(EventEmitter.prototype);

  Provider.prototype.send = function send(notification, recipients) {
    var _this = this;

    var builtNotification = {
      headers: notification.headers(),
      body: notification.compile()
    };

    if (!Array.isArray(recipients)) {
      recipients = [recipients];
    }

    return Promise.all(recipients.map(function (token) {
      return _this.client.write(builtNotification, token);
    })).then(function (responses) {
      var sent = [];
      var failed = [];

      responses.forEach(function (response) {
        if (response.status || response.error) {
          failed.push(response);
        } else {
          sent.push(response);
        }
      });
      return { sent: sent, failed: failed };
    });
  };

  Provider.prototype.shutdown = function shutdown() {
    this.client.shutdown();
  };

  return Provider;
};
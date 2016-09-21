"use strict";
const EventEmitter = require("events");

let Promise;
try {
  Promise = require("bluebird");
} catch (e) {
  Promise = global.Promise;
}

module.exports = function(dependencies) {
  const Client = dependencies.Client;

  function Provider (options) {
    if(false === (this instanceof Provider)) {
      return new Provider(options);
    }

    this.client = new Client(options);

    EventEmitter.call(this);
  }

  Provider.prototype = Object.create(EventEmitter.prototype);

  Provider.prototype.send = function send(notification, recipients) {
    const builtNotification = {
      headers: notification.headers(),
      body:    notification.compile(),
    };

    if (!Array.isArray(recipients)) {
      recipients = [recipients];
    }

    return Promise.all( recipients.map(this.client.write.bind(this.client, builtNotification)) )
      .then( responses => {
      let sent = [];
      let failed = [];

      responses.forEach( response => {
        if (response.status || response.error) {
          failed.push(response);
        } else {
          sent.push(response);
        }
      });
      return {sent, failed};
    });
  };

  Provider.prototype.shutdown = function shutdown() {
    this.client.shutdown();
  }

  return Provider;
};
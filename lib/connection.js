"use strict";
const EventEmitter = require("events");
const Promise = require("bluebird");
const extend = require("./util/extend");

module.exports = function(dependencies) {
  const config = dependencies.config;
  const Writer = require("./writer")(dependencies);

  function Connection (options) {
    if(false === (this instanceof Connection)) {
      return new Connection(options);
    }

    this.config = config(options);
    this.writer = new Writer(this.config);

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

    return Promise.all( recipients.map(this.writer.bind(this, builtNotification)) )
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

  return Connection;
};


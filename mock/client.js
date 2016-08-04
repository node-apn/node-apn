"use strict";

module.exports = function(dependencies) {

  function Client(options) {
  }

  Client.prototype.write = function mockWrite() {
    return {}
  }

  return Client
};

"use strict";

module.exports = function() {

  function Client() {
  }

  Client.prototype.write = function mockWrite() {
    return {};
  };

  return Client;
};

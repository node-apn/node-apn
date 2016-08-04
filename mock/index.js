"use strict";

const sinon = require("sinon");

const Client = require("./client")();

const Provider = require("../lib/provider")({
  Client,
});

const Notification = require("../lib/notification");

module.exports = {
  Provider,
  Notification,
  Client,
};

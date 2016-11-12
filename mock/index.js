"use strict";

const Client = require("./client")({
  logger: () => {}
});

const Provider = require("../lib/provider")({
  logger: () => {},
  Client
});

const Notification = require("../lib/notification")({
  logger: () => {}
});
const token = require("../lib/token");

module.exports = {
  Provider,
  Notification,
  Client,
  token
};

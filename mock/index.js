"use strict";

const Client = require("./client")();

const Provider = require("../lib/provider")({
  Client,
});

const Notification = require("../lib/notification");
const token = require("../lib/token");

module.exports = {
  Provider,
  Notification,
  Client,
  token,
};

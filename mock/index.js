"use strict";

const Client = require("./client")();

const Provider = require("../src/provider")({
  Client,
});

const Notification = require("../src/notification");
const token = require("../src/token");

module.exports = {
  Provider,
  Notification,
  Client,
  token,
};

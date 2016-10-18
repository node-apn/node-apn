"use strict";

var debug = require("debug")("apn");

var credentials = require("./lib/credentials")({
	logger: debug
});

var config = require("./lib/config")({
	logger: debug,
	prepareCertificate: credentials.certificate,
	prepareToken: credentials.token,
	prepareCA: credentials.ca
});

var tls = require("tls");

var framer = require("http2/lib/protocol/framer");
var compressor = require("http2/lib/protocol/compressor");

var protocol = {
	Serializer: framer.Serializer,
	Deserializer: framer.Deserializer,
	Compressor: compressor.Compressor,
	Decompressor: compressor.Decompressor,
	Connection: require("http2/lib/protocol/connection").Connection
};

var Endpoint = require("./lib/protocol/endpoint")({
	tls: tls,
	protocol: protocol
});

var EndpointManager = require("./lib/protocol/endpointManager")({
	Endpoint: Endpoint
});

var Client = require("./lib/client")({
	config: config,
	EndpointManager: EndpointManager
});

var Provider = require("./lib/provider")({
	Client: Client
});

var Notification = require("./lib/notification");

var token = require("./lib/token");

module.exports = {
	Provider: Provider,
	Notification: Notification,
	token: token
};

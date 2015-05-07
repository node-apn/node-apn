"use strict";
var tls = require("tls");
var net = require("net");

var debug = require("debug")("apn:socket");

function DestroyEPIPEFix(e) {
	// When a write error occurs we miss the opportunity to
	// read error data from APNS. Delay the call to destroy
	// to allow more data to be read.
	var socket = this;
	var args = arguments;
	var call = function () {
		socket._apnDestroy.apply(socket, args); 
	};
	
	if (e && e.syscall === "write") {
		setTimeout(call, 1000);
	}
	else {
		call();
	}
}

function apnSocketLegacy(connection, socketOptions, connected) {
	// For node < 0.12. We pass in our own Stream to delay connection 
	// until we have attached the event listeners below.
	socketOptions.socket = new net.Socket();

	if (!socketOptions.disableEPIPEFix) {
		socketOptions.socket._apnDestroy = socketOptions.socket._destroy;
		socketOptions.socket._destroy = DestroyEPIPEFix;
		socketOptions.socket.on("error", function () {});
	}

	var socket = tls.connect( socketOptions.port, socketOptions.host,
		socketOptions, connected);

	debug("connecting to: ", socketOptions.host + ":" + socketOptions.port);

	socketOptions.socket.setNoDelay(socketOptions.disableNagle);
	socketOptions.socket.setKeepAlive(true);
	if (socketOptions.connectionTimeout > 0) {
		socketOptions.socket.setTimeout(socketOptions.connectionTimeout);
	}

	// The actual connection is delayed until after all the event listeners have
	//  been attached.
	socketOptions.socket.connect(socketOptions.port, socketOptions.host);

	return socket;
}

function apnSocket(connection, socketOptions, connected) {

	var socket = tls.connect( socketOptions, connected);

	if (!socketOptions.disableEPIPEFix) {
		socket._apnDestroy = socket._destroy;
		socket._destroy = DestroyEPIPEFix;
	}

	socket.setNoDelay(socketOptions.disableNagle);
	socket.setKeepAlive(true);
	if (socketOptions.connectionTimeout > 0) {
		socket.setTimeout(socketOptions.connectionTimeout);
	}

	debug("connecting to: ", socketOptions.host + ":" + socketOptions.port);

	return socket;
}

if (tls.TLSSocket) {
	debug("Using 0.12 socket API");
	module.exports = apnSocket;
}
else {
	debug("Using legacy socket API");
	module.exports = apnSocketLegacy;
}
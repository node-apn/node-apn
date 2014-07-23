var tls = require('tls');
var net = require('net');

function destroyEPIPEFix(e) {
	// When a write error occurs we miss the opportunity to
	// read error data from APNS. Delay the call to destroy
	// to allow more data to be read.
	var self = this;
	var args = arguments;
	var call = function () {
		self._apnDestroy.apply(self, args); 
	}
	
	if (e && e.syscall == "write") {
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
		socketOptions.socket._destroy = destroyEPIPEFix;
		socketOptions.socket.on("error", function () {});
	}

	var socket = tls.connect( socketOptions['port'], socketOptions['host'],
		socketOptions, connected);

	socketOptions.socket.setNoDelay(socketOptions.disableNagle);
	socketOptions.socket.setKeepAlive(true);
	if (socketOptions.connectionTimeout > 0) {
		socketOptions.socket.setTimeout(socketOptions.connectionTimeout);
	}

	socket.on("error",   connection.errorOccurred.bind(connection, socket));
	socket.on("timeout", connection.socketTimeout.bind(connection, socket));
	socket.on("data",    connection.handleTransmissionError.bind(connection, socket));
	socket.on("drain",   connection.socketDrained.bind(connection, socket, true));
	socket.once("close", connection.socketClosed.bind(connection, socket));

	// The actual connection is delayed until after all the event listeners have
	//  been attached.
	socketOptions.socket.connect(socketOptions['port'], socketOptions['host']);

	return socket;
}

function apnSocket(connection, socketOptions, connected) {

	var socket = tls.connect( socketOptions, connected);

	if (!socketOptions.disableEPIPEFix) {
		socket._apnDestroy = socket._destroy;
		socket._destroy = destroyEPIPEFix;
	}

	socket.setNoDelay(socketOptions.disableNagle);
	socket.setKeepAlive(true);
	if (socketOptions.connectionTimeout > 0) {
		socket.setTimeout(socketOptions.connectionTimeout);
	}

	socket.on("error",   connection.errorOccurred.bind(connection, socket));
	socket.on("timeout", connection.socketTimeout.bind(connection, socket));
	socket.on("data",    connection.handleTransmissionError.bind(connection, socket));
	socket.on("drain",   connection.socketDrained.bind(connection, socket, true));
	socket.once("close", connection.socketClosed.bind(connection, socket));

	return socket;
}

if (tls.TLSSocket) {
	module.exports = apnSocket;
}
else {
	module.exports = apnSocketLegacy;
}
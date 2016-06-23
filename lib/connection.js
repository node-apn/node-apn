"use strict";

var Errors = require("./errors");

var q    = require("q");
var sysu = require("util");
var util = require("./util");
var events = require("events");
var Device = require("./device");
var loadCredentials = require("./credentials/load");
var parseCredentials = require("./credentials/parse");
var validateCredentials = require("./credentials/validate");

var createSocket = require("./socket");
var debug = require("debug")("apn");
var trace = require("debug")("apn:trace");

/**
 * Create a new connection to the APN service.
 * @constructor
 * @param {Object} [options]
 * @config {Buffer|String} [cert="cert.pem"] The filename of the connection certificate to load from disk, or a Buffer/String containing the certificate data.
 * @config {Buffer|String} [key="key.pem"] The filename of the connection key to load from disk, or a Buffer/String containing the key data.
 * @config {Buffer[]|String[]} [ca] An array of trusted certificates. Each element should contain either a filename to load, or a Buffer/String to be used directly. If this is omitted several well known "root" CAs will be used. - You may need to use this as some environments don't include the CA used by Apple (entrust_2048).
 * @config {Buffer|String} [pfx] File path for private key, certificate and CA certs in PFX or PKCS12 format, or a Buffer/String containing the PFX data. If supplied will be used instead of certificate and key above.
 * @config {String} [passphrase] The passphrase for the connection key, if required
 * @config {Boolean} [production=(NODE_ENV=='production')] Specifies which environment to connect to: Production (if true) or Sandbox. (Defaults to false, unless NODE_ENV == "production")
 * @config {Number} [port=2195] Gateway port
 * @config {Boolean} [rejectUnauthorized=true] Reject Unauthorized property to be passed through to tls.connect()
 * @config {Function} [errorCallback] A callback which accepts 2 parameters (err, notification). Use `transmissionError` event instead.
 * @config {Number} [cacheLength=1000] Number of notifications to cache for error purposes (See doc/apn.markdown)
 * @config {Boolean} [autoAdjustCache=false] Whether the cache should grow in response to messages being lost after errors. (Will still emit a 'cacheTooSmall' event)
 * @config {Number} [maxConnections=1] The maximum number of connections to create for sending messages.
 * @config {Number} [minConnections=1] The minimum number of connections to create for sending messages.
 * @config {Number} [connectionTimeout=3600000] The duration the socket should stay alive with no activity in milliseconds. 0 = Disabled.
 * @config {Boolean} [buffersNotifications=true] Whether to buffer notifications and resend them after failure.
 * @config {Boolean} [fastMode=false] Whether to aggresively empty the notification buffer while connected.
 */
function Connection (options) {
	if(false === (this instanceof Connection)) {
        return new Connection(options);
    }
	this.options = {
		cert: "cert.pem",
		key: "key.pem",
		ca: null,
		pfx: null,
		passphrase: null,
		production: (process.env.NODE_ENV === "production"),
		voip: false,
		address: null,
		port: 2195,
		rejectUnauthorized: true,
		cacheLength: 1000,
		autoAdjustCache: true,
		maxConnections: 1,
		minConnections: 1,
		connectTimeout: 10000,
		connectionTimeout: 3600000,
		connectionRetryLimit: 10,
		buffersNotifications: true,
		fastMode: false,
		disableNagle: false,
		disableEPIPEFix: false
	};

	for (var key in options) {
		if (options[key] === null || options[key] === undefined) {
			debug("Option [" + key + "] set to null. This may cause unexpected behaviour.");
		}
	}

	util.extend(this.options, options);

	this.configureAddress();

	if (this.options.pfx || this.options.pfxData) {
		this.options.cert = options.cert;
		this.options.key = options.key;
	}

	// Set cache length to 1 to ensure transmitted notifications can be sent.
	this.options.cacheLength = Math.max(this.options.cacheLength, 1);
	this.options.maxConnections = Math.max(this.options.maxConnections, 1);
	this.options.minConnections = Math.max(this.options.minConnections, 1);
	this.deferredConnection = null;
	this.sockets = [];
	this.notificationBuffer  = [];

	this.socketId = 0;

	this.failureCount = 0; 
	this.currentConnectionRoundRobin = 0;

	// when true, we end all sockets after the pending notifications reach 0
	this.shutdownPending = false;

	// track when notifications are queued so transmitCompleted is only emitted one when
	// notifications are transmitted rather than after socket timeouts
	this.notificationsQueued = false;

	this.terminated = false;

	events.EventEmitter.call(this);
}

sysu.inherits(Connection, events.EventEmitter);


/**
 *
 * @private
 */
Connection.prototype.maintainMinConnection = function() {
	if (this.sockets.length < this.options.minConnections && !this.shutdownPending) {
		this.createConnection();
	}
};

Connection.prototype.configureAddress = function() {
	if (this.options.gateway) {
		this.options.address = this.options.gateway;
	}

	if (!this.options.address) {
		if (this.options.production) {
			this.options.address = "gateway.push.apple.com";
		}
		else {
			this.options.address = "gateway.sandbox.push.apple.com";
		}
	}
	else {
		if (this.options.address === "gateway.push.apple.com") {
			this.options.production = true;
		}
		else {
			this.options.production = false;
		}
	}
};

/**
 * You should never need to call this method, initialization and connection is handled by {@link Connection#sendNotification}
 * @private
 */
Connection.prototype.loadCredentials = function () {
	if (!this.credentialsPromise) {
		debug("Loading Credentials");

		var production = this.options.production;
		this.credentialsPromise = loadCredentials(this.options)
			.then(function(credentials) {
				var parsed;
				try {
					parsed = parseCredentials(credentials);
				}
				catch (e) {
					debug(e);
					return credentials;
				}
				parsed.production = production;
				validateCredentials(parsed);
				return credentials;
			});
	}

	return this.credentialsPromise;
};

/**
 * You should never need to call this method, initialisation and connection is handled by {@link Connection#pushNotification}
 * @private
 */
Connection.prototype.createSocket = function () {
	if (this.deferredConnection) {
		return this.deferredConnection.promise;
	}

	debug("Initialising connection");
	this.deferredConnection = q.defer();
	this.loadCredentials().then(function(credentials) {
		var socketOptions = {};

		socketOptions.port = this.options.port;
		socketOptions.host = this.options.address;
		socketOptions.disableEPIPEFix = this.options.disableEPIPEFix;

		socketOptions.disableNagle = this.options.disableNagle;
		socketOptions.connectionTimeout = this.options.connectionTimeout;

		socketOptions.pfx = credentials.pfx;
		socketOptions.cert = credentials.cert;
		socketOptions.key = credentials.key;
		socketOptions.ca = credentials.ca;
		socketOptions.passphrase = this.options.passphrase;
		socketOptions.rejectUnauthorized = this.options.rejectUnauthorized;

		this.socket = createSocket(this, socketOptions,
			function () {
				debug("Connection established");
				this.emit("connected", this.sockets.length + 1);
				if(this.deferredConnection) {
					this.deferredConnection.resolve();
				}
			}.bind(this));

		this.socket.on("error",   this.errorOccurred.bind(this, this.socket));
		this.socket.on("timeout", this.socketTimeout.bind(this, this.socket));
		this.socket.on("data",    this.handleTransmissionError.bind(this, this.socket));
		this.socket.on("drain",   this.socketDrained.bind(this, this.socket, true));
		this.socket.once("close", this.socketClosed.bind(this, this.socket));
	}.bind(this)).done(null, function (error) {
		debug("Module initialisation error:", error);

		// This is a pretty fatal scenario, we don't have key/certificate to connect to APNS, there's not much we can do, so raise errors and clear the queue.
		this.rejectBuffer(Errors.moduleInitialisationFailed);
		this.emit("error", error);
		this.deferredConnection.reject(error);
		this.terminated = true;
	}.bind(this));

	if (this.options.connectTimeout > 0) {
		var connectionTimer = setTimeout(function () {
			if(this.deferredConnection) {
				this.deferredConnection.reject(new Error("Connect timed out"));
			}
			if(this.socket) {
				this.socket.end();
			}
		}.bind(this), this.options.connectTimeout);

		return this.deferredConnection.promise.finally(function() {
			clearTimeout(connectionTimer);
		});
	}

	return this.deferredConnection.promise;
};

/**
 * @private
 */
Connection.prototype.createConnection = function() {
	if (this.initialisingConnection() || this.sockets.length >= this.options.maxConnections) {
		return;
	}

	// Delay here because Apple will successfully authenticate production certificates
	// in sandbox, but will then immediately close the connection. Necessary to wait for a beat
	// to see if the connection stays before sending anything because the connection will be closed
	// without error and messages could be lost.
	this.createSocket().delay(100).then(function () {
		if (this.socket.apnRetired) {
			throw new Error("Socket unusable after connection. Hint: You may be using a certificate for the wrong environment");
		}
		this.failureCount = 0;

		this.socket.apnSocketId = this.socketId++;
		this.socket.apnCurrentId = 0;
		this.socket.apnCachedNotifications = [];

		this.sockets.push(this.socket);
		trace("connection established", this.socketId);
	}.bind(this)).fail(function (error) {
		// Exponential backoff when connections fail.
		var delay = Math.pow(2, this.failureCount++) * 1000;

		trace("connection failed", delay);

		this.raiseError(error);
		this.emit("socketError", error);

		if (this.options.connectionRetryLimit > 0 
			&& this.failureCount > this.options.connectionRetryLimit
			&& this.sockets.length === 0) {
			this.rejectBuffer(Errors.connectionRetryLimitExceeded);
			this.emit("error", error);
			this.shutdown();
			this.terminated = true;
			return;
		}

		return q.delay(delay);
	}.bind(this)).finally(function () {
		trace("create completed", this.sockets.length);
		this.deferredConnection = null;
		this.socket = undefined;
		this.maintainMinConnection();
		this.serviceBuffer();
	}.bind(this)).done(null, function(error) {
		this.emit("error", error);
	}.bind(this));
};

/**
 * @private
 */
Connection.prototype.initialisingConnection = function() {
	if(this.deferredConnection !== null) {
		return true;
	}
	return false;
};

/**
 * @private
 */
 Connection.prototype.serviceBuffer = function() {

	var socket = null;
	var repeat = false;
	var socketsAvailable = 0;
	if(this.options.fastMode) {
		repeat = true;
	}
	do {
		socketsAvailable = 0;
		for (var i = 0; i < this.sockets.length; i++) {
 			var roundRobin = this.currentConnectionRoundRobin;
			socket = this.sockets[roundRobin];
			if(!this.socketAvailable(socket)) {
				continue;
			}

			if (this.notificationBuffer.length === 0) {
				socketsAvailable += 1;
				break;
			}
			this.currentConnectionRoundRobin = (roundRobin + 1) % this.sockets.length;      

			// If a socket is available then transmit. If true is returned then manually call socketDrained
			if (this.transmitNotification(socket, this.notificationBuffer.shift())) {
				// Only set socket available here because if transmit returns false then the socket
				//  is blocked so shouldn't be used in the next loop.
				socketsAvailable += 1;
				this.socketDrained(socket, !repeat);
			}
		}
	} while(repeat && socketsAvailable > 0 && this.notificationBuffer.length > 0);

	if (this.notificationBuffer.length > 0 && socketsAvailable === 0) {
		this.createConnection();
	}
	
	if (this.notificationBuffer.length === 0 && socketsAvailable === this.sockets.length){
		if (this.notificationsQueued) {
			this.emit("completed");
			this.notificationsQueued = false;
		}
		if (this.shutdownPending) {
			debug("closing connections");

			for (var j = 0; j < this.sockets.length; j++) {
				socket = this.sockets[j];
				// We delay before closing connections to ensure we don't miss any error packets from the service.
				setTimeout(socket.end.bind(socket), 2500);
				this.retireSocket(socket);
			}
		}
	}

	debug("%d left to send", this.notificationBuffer.length);
 };

/**
 * @private
 */
Connection.prototype.errorOccurred = function(socket, err) {
	debug("Socket error occurred", socket.apnSocketId, err);

	if(socket.transmissionErrorOccurred && err.code === "EPIPE") {
		debug("EPIPE occurred after a transmission error which we can ignore");
		return;
	}

	if(this.socket === socket && this.deferredConnection && this.deferredConnection.promise.isPending()) {
		this.deferredConnection.reject(err);
	}
	else {
		this.emit("socketError", err);
		this.raiseError(err, null);
	}

	if(socket.apnBusy && socket.apnCachedNotifications.length > 0) {
		// A notification was in flight. It should be buffered for resending.
		this.bufferNotification(socket.apnCachedNotifications[socket.apnCachedNotifications.length - 1]);
	}

	this.destroyConnection(socket);
};

/**
 * @private
 */
Connection.prototype.socketAvailable = function(socket) {
	if (!socket || !socket.writable || socket.apnRetired || socket.apnBusy || socket.transmissionErrorOccurred) {
		return false;
	}
	return true;
};

/**
 * @private
 */
Connection.prototype.socketDrained = function(socket, serviceBuffer) {
	debug("Socket drained", socket.apnSocketId);
	socket.apnBusy = false;
	if(socket.apnCachedNotifications.length > 0) {
		var notification = socket.apnCachedNotifications[socket.apnCachedNotifications.length - 1];
		this.emit("transmitted", notification.notification, notification.recipient);
	}
	if(serviceBuffer === true && !this.runningOnNextTick) {
		// There is a possibility that this could add multiple invocations to the 
		// call stack unnecessarily. It will be resolved within one event loop but 
		// should be mitigated if possible, this.nextTick aims to solve this, 
		// ensuring "serviceBuffer" is only called once per loop.
		util.setImmediate(function() { 
			this.runningOnNextTick = false;
			this.serviceBuffer(); 
		}.bind(this));
		this.runningOnNextTick = true;
	}
};

/**
 * @private
 */
 Connection.prototype.socketTimeout = function(socket) {
	debug("Socket timeout", socket.apnSocketId);
	this.emit("timeout");
	this.destroyConnection(socket);

	this.serviceBuffer();
 };

/**
 * @private
 */
Connection.prototype.destroyConnection = function(socket) {
	debug("Destroying connection", socket.apnSocketId);
	if (socket) {
		this.retireSocket(socket);
		socket.destroy();
	}
};

/**
 * @private
 */
Connection.prototype.socketClosed = function(socket) {
	debug("Socket closed", socket.apnSocketId);

	if (socket === this.socket && this.deferredConnection.promise.isPending()) {
		debug("Connection error occurred before TLS Handshake");
		this.deferredConnection.reject(new Error("Unable to connect"));
	}
	else {
		this.retireSocket(socket);
		this.emit("disconnected", this.sockets.length);
	}

	this.serviceBuffer();
};

/**
 * @private
 */
 Connection.prototype.retireSocket = function(socket) {
 	debug("Removing socket from pool", socket.apnSocketId);

 	socket.apnRetired = true;
 	var index = this.sockets.indexOf(socket);
	if (index > -1) {
		this.sockets.splice(index, 1);
	}
 	this.maintainMinConnection();
 };

/**
 * Use this method to modify the cache length after initialisation.
 */
Connection.prototype.setCacheLength = function(newLength) {
	this.options.cacheLength = newLength;
};

/**
 * @private
 */
Connection.prototype.bufferNotification = function (notification) {
	if (notification.retryLimit === 0) {
		this.raiseError(Errors.retryLimitExceeded, notification);
		this.emit("transmissionError", Errors.retryLimitExceeded, notification.notification, notification.recipient);
		return;
	}
	notification.retryLimit -= 1;
	this.notificationBuffer.push(notification);
	this.notificationsQueued = true;
};

/**
 * @private
 */
Connection.prototype.rejectBuffer = function (errCode) {
	while(this.notificationBuffer.length > 0) {
		var notification = this.notificationBuffer.shift();
		this.raiseError(errCode, notification.notification, notification.recipient);
		this.emit("transmissionError", errCode, notification.notification, notification.recipient);
	}
};

/**
 * @private
 */
Connection.prototype.prepareNotification = function (notification, device) {
	var recipient = device;
	// If a device token hasn't been given then we should raise an error.
	if (recipient === undefined) {
		util.setImmediate(function () {
			this.raiseError(Errors.missingDeviceToken, notification);
			this.emit("transmissionError", Errors.missingDeviceToken, notification);
		}.bind(this));
		return;
	}

	// If we have been passed a token instead of a `Device` then we should convert.
	if (!(recipient instanceof Device)) {
		try {
			recipient = new Device(recipient);
		}
		catch (e) {
			// If an exception has been thrown it's down to an invalid token.
			util.setImmediate(function () {
				this.raiseError(Errors.invalidToken, notification, device);
				this.emit("transmissionError", Errors.invalidToken, notification, device);
			}.bind(this));
			return;
		}
	}

	var retryLimit = (notification.retryLimit < 0) ? -1 : notification.retryLimit + 1;
	this.bufferNotification( { "notification": notification, "recipient": recipient, "retryLimit": retryLimit } );
};

/**
 * @private
 */
Connection.prototype.cacheNotification = function (socket, notification) {
	socket.apnCachedNotifications.push(notification);
	if (socket.apnCachedNotifications.length > this.options.cacheLength) {
		debug("Clearing notification %d from the cache", socket.apnCachedNotifications[0]._uid);
		socket.apnCachedNotifications.splice(0, socket.apnCachedNotifications.length - this.options.cacheLength);
	}
};

/**
 * @private
 */
Connection.prototype.handleTransmissionError = function (socket, data) {
	if (data[0] === 8) {
		socket.transmissionErrorOccurred = true;

		var errorCode = data[1];
		var identifier = data.readUInt32BE(2);
		var notification = null;
		var foundNotification = false;
		var temporaryCache = [];

		debug("Notification %d caused an error: %d", identifier, errorCode);

		while (socket.apnCachedNotifications.length) {
			notification = socket.apnCachedNotifications.shift();
			if (notification._uid === identifier) {
				foundNotification = true;
				break;
			}
			temporaryCache.push(notification);
		}

		if (foundNotification) {
			while (temporaryCache.length) {
				temporaryCache.shift();
			}
			this.emit("transmissionError", errorCode, notification.notification, notification.recipient);
			this.raiseError(errorCode, notification.notification, notification.recipient);
		}
		else {
			socket.apnCachedNotifications = temporaryCache;

			if(socket.apnCachedNotifications.length > 0) {
				var differentialSize = socket.apnCachedNotifications[0]._uid - identifier;
				this.emit("cacheTooSmall", differentialSize);
				if(this.options.autoAdjustCache) {
					this.options.cacheLength += differentialSize * 2;
				}
			}

			this.emit("transmissionError", errorCode, null);
			this.raiseError(errorCode, null);
		}

		var count = socket.apnCachedNotifications.length;
		if(this.options.buffersNotifications) {
			debug("Buffering %d notifications for resending", count);
			for (var i = 0; i < count; ++i) {
				notification = socket.apnCachedNotifications.shift();
				this.bufferNotification(notification);
			}
		}
	}
	else {
		debug("Unknown data received: ", data);
	}
};

/**
 * @private
 */
Connection.prototype.raiseError = function(errorCode, notification, recipient) {
	debug("Raising error:", errorCode, notification, recipient);

	if(errorCode instanceof Error) {
		debug("Error occurred with trace:", errorCode.stack);
	}

	if (notification && typeof notification.errorCallback === "function" ) {
		notification.errorCallback(errorCode, recipient);
	} else if (typeof this.options.errorCallback === "function") {
		this.options.errorCallback(errorCode, notification, recipient);
	}
};

/**
 * @private
 * @return {Boolean} Write completed, returns true if socketDrained should be called by the caller of this method.
 */
Connection.prototype.transmitNotification = function(socket, notification) {
	var token = notification.recipient.token;
	var encoding = notification.notification.encoding || "utf8";
	var message = notification.notification.compile();
	var messageLength = Buffer.byteLength(message, encoding);
	var position = 0;
	var data;

	notification._uid = socket.apnCurrentId++;
	if (socket.apnCurrentId > 0xffffffff) {
		socket.apnCurrentId = 0;
	}

	// New Protocol uses framed notifications consisting of multiple items
	// 1: Device Token
	// 2: Payload
	// 3: Notification Identifier
	// 4: Expiration Date
	// 5: Priority
	// Each item has a 3 byte header: Type (1), Length (2) followed by data
	// The frame layout is hard coded for now as original dynamic system had a
	// significant performance penalty

	var frameLength = 3 + token.length + 3 + messageLength + 3 + 4;
	if(notification.notification.expiry > 0) {
		frameLength += 3 + 4;
	}
	if(notification.notification.priority !== 10) {
		frameLength += 3 + 1;
	}

	// Frame has a 5 byte header: Type (1), Length (4) followed by items.
	data = new Buffer(5 + frameLength);
	data[position] = 2; position += 1;

	// Frame Length
	data.writeUInt32BE(frameLength, position); position += 4;

	// Token Item
	data[position] = 1; position += 1;
	data.writeUInt16BE(token.length, position); position += 2;
	position += token.copy(data, position, 0);

	// Payload Item
	data[position] = 2; position += 1;
	data.writeUInt16BE(messageLength, position); position += 2;
	position += data.write(message, position, encoding);

	// Identifier Item
	data[position] = 3; position += 1;
	data.writeUInt16BE(4, position); position += 2;
	data.writeUInt32BE(notification._uid, position); position += 4;

	if(notification.notification.expiry > 0) {
		// Expiry Item
		data[position] = 4; position += 1;
		data.writeUInt16BE(4, position); position += 2;
		data.writeUInt32BE(notification.notification.expiry, position); position += 4;
	}
	if(notification.notification.priority !== 10) {
		// Priority Item
		data[position] = 5; position += 1;
		data.writeUInt16BE(1, position); position += 2;
		data[position] = notification.notification.priority; position += 1;
	}

	this.cacheNotification(socket, notification);

	socket.apnBusy = true;
	return socket.write(data);
};

Connection.prototype.validNotification = function (notification, recipient) {
	var messageLength = notification.length();
	var maxLength = (this.options.voip ? 4096 : 2048);
	
	if (messageLength > maxLength) {
		util.setImmediate(function () {
			this.raiseError(Errors.invalidPayloadSize, notification, recipient);
			this.emit("transmissionError", Errors.invalidPayloadSize, notification, recipient);
		}.bind(this));
		return false;
	}
	return true;
};

/**
 * Queue a notification for delivery to recipients
 * @param {Notification} notification The Notification object to be sent
 * @param {Device|String|Buffer|Device[]|String[]|Buffer[]} recipient The token(s) for devices the notification should be delivered to.
 * @since v1.3.0
 */
Connection.prototype.pushNotification = function (notification, recipient) {
	if (this.terminated) {
		this.emit("transmissionError", Errors.connectionTerminated, notification, recipient);
		return false;
	}
	if (!this.validNotification(notification, recipient)) {
		return;
	}
	if (sysu.isArray(recipient)) {
		for (var i = recipient.length - 1; i >= 0; i--) {
			this.prepareNotification(notification, recipient[i]);
		}
	}
	else {
		this.prepareNotification(notification, recipient);
	}

	this.shutdownPending = false;
	this.serviceBuffer();
};

/**
 * Send a notification to the APN service
 * @param {Notification} notification The notification object to be sent
 * @deprecated Since v1.3.0, use pushNotification instead
 */
Connection.prototype.sendNotification = function (notification) {
	return this.pushNotification(notification, notification.device);
};

/**
 * End connections with APNS once we've finished sending all notifications
 */
Connection.prototype.shutdown = function () {
	debug("Shutdown pending");
	this.shutdownPending = true;
};

module.exports = Connection;

var Errors = require('./errors');

var fs   = require('fs');
var q    = require('q');
var tls  = require('tls');
var net  = require('net');
var sysu = require('util');
var util = require('./util');
var Device = require('./device');
var events = require('events');
var debug = function() {};
if(process.env.DEBUG) {
	try {
		debug = require('debug')('apn');
	}
	catch (e) {
		console.log("Notice: 'debug' module is not available. This should be installed with `npm install debug` to enable debug messages", e);
		debug = function() {};
	}
}

/**
 * Create a new connection to the APN service.
 * @constructor
 * @param {Object} [options]
 * @config {String} [cert="cert.pem"] The filename of the connection certificate to load from disk
 * @config {Buffer|String} [certData] The certificate data. If supplied, will be used instead of loading from disk.
 * @config {String} [key="key.pem"] The filename of the connection key to load from disk
 * @config {Buffer|String} [keyData] The key data. If supplied will be used instead of loading from disk.
 * @config {Buffer[]|String[]} [ca] An array of strings or Buffers of trusted certificates. If this is omitted several well known "root" CAs will be used, like VeriSign. - You may need to use this as some environments don't include the CA used by Apple.
 * @config {String} [pfx] File path for private key, certificate and CA certs in PFX or PKCS12 format. If supplied will be used instead of certificate and key above
 * @config {Buffer|String} [pfxData] PFX or PKCS12 format data containing the private key, certificate and CA certs. If supplied will be used instead of loading from disk.
 * @config {String} [passphrase] The passphrase for the connection key, if required
 * @config {String} [gateway="gateway.push.apple.com"] The gateway server to connect to.
 * @config {Number} [port=2195] Gateway port
 * @config {Boolean} [rejectUnauthorized=true] Reject Unauthorized property to be passed through to tls.connect()
 * @config {Boolean} [enhanced=true] Whether to use the enhanced notification format (recommended)
 * @config {Function} [errorCallback] A callback which accepts 2 parameters (err, notification). Use `transmissionError` event instead.
 * @config {Number} [cacheLength=100] Number of notifications to cache for error purposes (See doc/apn.markdown)
 * @config {Boolean} [autoAdjustCache=false] Whether the cache should grow in response to messages being lost after errors. (Will still emit a 'cacheTooSmall' event)
 * @config {Number} [maxConnections=1] The maximum number of connections to create for sending messages.
 * @config {Number} [connectionTimeout=0] The duration the socket should stay alive with no activity in milliseconds. 0 = Disabled.
 * @config {Boolean} [buffersNotifications=true] Whether to buffer notifications and resend them after failure.
 * @config {Boolean} [fastMode=false] Whether to aggresively empty the notification buffer while connected.
 */
function Connection (options) {
	if(false === (this instanceof Connection)) {
        return new Connection(options);
    }
	this.options = {
		cert: 'cert.pem',
		certData: null,
		key: 'key.pem',
		keyData: null,
		ca: null,
		pfx: null,
		pfxData: null,
		passphrase: null,
		gateway: 'gateway.push.apple.com',
		port: 2195,
		rejectUnauthorized: true,
		enhanced: true,
		cacheLength: 100,
		autoAdjustCache: true,
		maxConnections: 1,
		connectionTimeout: 0,
		buffersNotifications: true
	};

	util.extend(this.options, options);

	this.certData = null;
	this.keyData  = null;
	this.pfxData = null;

	this.deferredInitialize = null;
	this.deferredConnection = null;

	this.sockets = [];
	this.notificationBuffer  = [];

	this.socketId = 0;

	events.EventEmitter.call(this);
}

sysu.inherits(Connection, events.EventEmitter);

/**
 * @private
 */
Connection.prototype.checkInitialized = function () {
	if ((this.keyData && this.certData) || this.pfxData) {
		this.deferredInitialize.resolve();
	}
};

/**
 * You should never need to call this method, initialisation and connection is handled by {@link Connection#sendNotification}
 * @private
 */
Connection.prototype.initialize = function () {
	if (this.deferredInitialize) {
		return this.deferredInitialize.promise;
	}

	debug("Initialising module");
	this.deferredInitialize = q.defer();

	if(this.options.pfx !== null || this.options.pfxData !== null) {
		if(this.options.pfxData) {
			this.pfxData = this.options.pfxData;
		}
		else {
			fs.readFile(this.options.pfx, function (err, data) {
				if (err) {
					this.deferredInitialize.reject(err);
					return;
				}
				this.pfxData = data;
				this.checkInitialized();
			}.bind(this));
		}
	}
	else {
		if (this.options.certData) {
			this.certData = this.options.certData;
		}
		else {
			fs.readFile(this.options.cert, function (err, data) {
				if (err) {
					this.deferredInitialize.reject(err);
					return;
				}
				this.certData = data.toString();
				this.checkInitialized();
			}.bind(this));
		}

		if (this.options.keyData) {
			this.keyData = this.options.keyData;
		}
		else {
			fs.readFile(this.options.key, function (err, data) {
				if (err) {
					this.deferredInitialize.reject(err);
					return;
				}
				this.keyData = data.toString();
				this.checkInitialized();
			}.bind(this));
		}
	}

	this.checkInitialized();
	return this.deferredInitialize.promise;
};

/**
 * You should never need to call this method, initialisation and connection is handled by {@link Connection#pushNotification}
 * @private
 */
Connection.prototype.connect = function () {
	if (this.deferredConnection) {
		return this.deferredConnection.promise;
	}

	debug("Initialising connection");
	this.deferredConnection = q.defer();
	this.initialize().then(function () {
		var socketOptions = {};

		if(this.pfxData) {
			socketOptions.pfx = this.pfxData;
		}
		else {
			socketOptions.key = this.keyData;
			socketOptions.cert = this.certData;
			socketOptions.ca = this.options.ca;
		}
		socketOptions.passphrase = this.options.passphrase;
		socketOptions.rejectUnauthorized = this.options.rejectUnauthorized;

		// We pass in our own Stream to delay connection until we have attached the
		//  event listeners below.
		socketOptions.socket = new net.Stream();

		this.socket = tls.connect(
			this.options['port'],
			this.options['gateway'],
			socketOptions,
			function () {
				debug("Connection established");
				this.emit('connected', this.sockets.length + 1);
				this.deferredConnection.resolve();
			}.bind(this));


		this.socket.setNoDelay(false);
		this.socket.setTimeout(this.options.connectionTimeout);

		this.socket.on("error", this.errorOccurred.bind(this, this.socket));
		this.socket.on("timeout", this.socketTimeout.bind(this, this.socket));
		this.socket.on("data", this.handleTransmissionError.bind(this, this.socket));
		this.socket.on("drain", this.socketDrained.bind(this, this.socket, true));
		this.socket.on("clientError", this.errorOccurred.bind(this, this.socket));
		this.socket.once("close", this.socketClosed.bind(this, this.socket));

		// The actual connection is delayed until after all the event listeners have
		//  been attached.
		socketOptions.socket.connect(this.options['port'], this.options['gateway']);
	}.bind(this)).fail(function (error) {
		debug("Module initialisation error:", error);
		this.emit('error', error);
		this.deferredConnection.reject(error);
		this.deferredConnection = null;
	}.bind(this));

	return this.deferredConnection.promise;
};

/**
 * @private
 */
Connection.prototype.createConnection = function() {
	this.connect().then(function () {
		this.socket.socketId = this.socketId++;
		this.socket.currentId = 0;
		this.socket.cachedNotifications = [];

		this.deferredConnection = null;
		this.sockets.push(this.socket);
		this.socket = undefined;
		this.serviceBuffer();
	}.bind(this)).fail(function (err) {
		this.deferredConnection = null;
		this.socket = undefined;
		this.serviceBuffer();
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
	if(this.options.fastMode) {
		repeat = true;
	}
	do {
		socket = null;
		if (this.notificationBuffer.length === 0) return;
		for (var i = this.sockets.length - 1; i >= 0; i--) {
			if(this.socketAvailable(this.sockets[i])) {
				socket = this.sockets[i];
				break;
			}
		}
		if (socket !== null) {
			debug("Transmitting notification from buffer");
			if(this.transmitNotification(socket, this.notificationBuffer.shift())) {
				this.socketDrained(socket, !repeat);
			}
		}
		else if (!this.initialisingConnection() && this.sockets.length < this.options.maxConnections) {
			this.createConnection();
			repeat = false;
		}
		else {
			repeat = false;
		}
	} while(repeat);
	debug("%d left to send", this.notificationBuffer.length);
 };

/**
 * @private
 */
Connection.prototype.errorOccurred = function(socket, err) {
	debug("Socket error occurred", socket.socketId, err);
	
	if(socket.transmissionErrorOccurred && err.code == 'EPIPE') {
		debug("EPIPE occurred after a transmission error which we can ignore");
		return;
	}

	this.emit('socketError', err);
	if(this.socket == socket && this.deferredConnection && this.deferredConnection.promise.isPending()) {
		this.deferredConnection.reject(err);
	}
	else {
		this.raiseError(err, null);
	}
	this.destroyConnection(socket);
};

/**
 * @private
 */
Connection.prototype.socketAvailable = function(socket) {
	if (!socket || !socket.writable || socket.busy) {
		return false;
	}
	return true;
};

/**
 * @private
 */
Connection.prototype.socketDrained = function(socket, serviceBuffer) {
	debug("Socket drained", socket.socketId);
	socket.busy = false;
	if(this.options.enhanced) {
		var notification = socket.cachedNotifications[socket.cachedNotifications.length - 1];
		this.emit('transmitted', notification.notification, notification.recipient);
	}
	if(serviceBuffer === true && !this.runningOnNextTick) {
		// There is a possibility that this could add multiple invocations to the 
		// call stack unnecessarily. It will be resolved within one event loop but 
		// should be mitigated if possible, this.nextTick aims to solve this, 
		// ensuring "serviceBuffer" is only called once per loop.
		var nextRun = function() { this.runningOnNextTick = false; this.serviceBuffer(); }.bind(this);
		if('function' === typeof setImmediate) {
			setImmediate(nextRun);
		}
		else {
			process.nextTick(nextRun);
		}
		this.runningOnNextTick = true;
	}
};

/**
 * @private
 */
 Connection.prototype.socketTimeout = function(socket) {
	debug("Socket timeout", socket.socketId);
	this.emit('timeout');
	socket.end();
 };

/**
 * @private
 */
Connection.prototype.destroyConnection = function(socket) {
	debug("Destroying connection", socket.socketId);
	if (socket) {
		socket.destroy();
	}
};

/**
 * @private
 */
Connection.prototype.socketClosed = function(socket) {
	debug("Socket closed", socket.socketId);

	if (socket === this.socket && !this.deferredConnection.promise.isPending()) {
		debug("Connection error occurred before TLS Handshake");
		this.deferredConnection.reject(new Error("Unable to connect"));
	}
	else {
		var index = this.sockets.indexOf(socket);
		if (index > -1) {
			this.sockets.splice(index, 1);
		}

		this.emit('disconnected', this.sockets.length);
	}

	this.serviceBuffer();
};

/**
 * @private
 */
Connection.prototype.bufferNotification = function (notification) {
	this.notificationBuffer.push(notification);
};

/**
 * @private
 */
Connection.prototype.cacheNotification = function (socket, notification) {
	socket.cachedNotifications.push(notification);
	if (socket.cachedNotifications.length > this.options.cacheLength) {
		debug("Clearing notification %d from the cache", socket.cachedNotifications[0]['_uid']);
		socket.cachedNotifications.shift();
	}
};

/**
 * @private
 */
Connection.prototype.handleTransmissionError = function (socket, data) {
	socket.destroy();
	if (data[0] == 8) {
		if (!this.options.enhanced) {
			return;
		}

		var errorCode = data[1];
		var identifier = data.readUInt32BE(2);
		var notification = null;
		var foundNotification = false;
		var temporaryCache = [];

		debug("Notification %d caused an error: %d", identifier, errorCode);

		while (socket.cachedNotifications.length) {
			notification = socket.cachedNotifications.shift();
			if (notification['_uid'] == identifier) {
				foundNotification = true;
				break;
			}
			temporaryCache.push(notification);
		}

		if (foundNotification) {
			while (temporaryCache.length) {
				temporaryCache.shift();
			}
			this.emit('transmissionError', errorCode, notification.notification, notification.recipient);
			this.raiseError(errorCode, notification.notification, notification.recipient);
		}
		else {
			socket.cachedNotifications = temporaryCache;

			if(socket.cachedNotifications.length > 0) {
				var differentialSize = socket.cachedNotifications[0]['_uid'] - identifier;
				this.emit('cacheTooSmall', differentialSize);
				if(this.options.autoAdjustCache) {
					this.options.cacheLength += differentialSize * 2;
				}
			}

			this.emit('transmissionError', errorCode, null);
			this.raiseError(errorCode, null);
		}

		var count = socket.cachedNotifications.length;
		if(this.options.buffersNotifications) {
			debug("Buffering %d notifications for resending", count);
			for (var i = 0; i < count; ++i) {
				notification = socket.cachedNotifications.shift();
				this.bufferNotification(notification);
			}
		}

		socket.transmissionErrorOccurred = true;
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

	if (notification && typeof notification.errorCallback == 'function' ) {
		notification.errorCallback(errorCode, recipient);
	} else if (typeof this.options.errorCallback == 'function') {
		this.options.errorCallback(errorCode, notification, recipient);
	}
};

/**
 * @private
 * @return {Boolean} Write completed, returns true if socketDrained should be called by the caller of this method.
 */
Connection.prototype.transmitNotification = function(socket, notification) {
	if (!this.socketAvailable(socket)) {
		this.bufferNotification(notification);
		return;
	}

	var token = notification.recipient.token;
	var encoding = notification.notification.encoding || 'utf8';
	var message = notification.notification.compile();
	var messageLength = Buffer.byteLength(message, encoding);
	var position = 0;
	var data;

	notification._uid = socket.currentId++;
	if (socket.currentId > 0xffffffff) {
		socket.currentId = 0;
	}
	if (this.options.enhanced) {
		data = new Buffer(1 + 4 + 4 + 2 + token.length + 2 + messageLength);
		// Command
		data[position] = 1;
		position++;

		// Identifier
		data.writeUInt32BE(notification._uid, position);
		position += 4;

		// Expiry
		data.writeUInt32BE(notification.notification.expiry, position);
		position += 4;
		this.cacheNotification(socket, notification);
	}
	else {
		data = new Buffer(1 + 2 + token.length + 2 + messageLength);
		//Command
		data[position] = 0;
		position++;
	}
	// Token Length
	data.writeUInt16BE(token.length, position);
	position += 2;
	// Device Token
	position += token.copy(data, position, 0);
	// Payload Length
	data.writeUInt16BE(messageLength, position);
	position += 2;
	//Payload
	position += data.write(message, position, encoding);

	socket.busy = true;
	return socket.write(data);
};

Connection.prototype.validNotification = function (notification, recipient) {
	var messageLength = notification.length();

	if (messageLength > 256) {
		process.nextTick(function () {
			this.raiseError(Errors['invalidPayloadSize'], notification, recipient);
			this.emit('transmissionError', Errors['invalidPayloadSize'], notification, recipient);
		}.bind(this));
		return false;
	}
	notification.compile();
	return true;
};

/**
 * Queue a notification for delivery to recipients
 * @param {Notification} notification The Notification object to be sent
 * @param {Device|String|Buffer|Device[]|String[]|Buffer[]} recipient The token(s) for devices the notification should be delivered to.
 * @since v1.3.0
 */
Connection.prototype.pushNotification = function (notification, recipient) {
	if (!this.validNotification(notification, recipient)) {
		return;
	}
	if (sysu.isArray(recipient)) {
		for (var i = recipient.length - 1; i >= 0; i--) {
			var device = recipient[i];
			if (!(device instanceof Device)) {
				device = new Device(device);
			}
			this.bufferNotification({ "notification": notification, "recipient": device });
		}
	}
	else {
		if (recipient === undefined) {
			process.nextTick(function () {
				this.raiseError(Errors['missingDeviceToken'], notification);
				this.emit('transmissionError', Errors['missingDeviceToken'], notification);
			}.bind(this));
			return Errors['missingDeviceToken'];
		}
		var device = recipient;
		if (!(device instanceof Device)) {
			device = new Device(device);
		}
		this.bufferNotification({"notification":notification, "recipient":device });
	}

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

module.exports = Connection;

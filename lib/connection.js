var Errors = require('./errors');

var fs   = require('fs');
var q    = require('q');
var tls  = require('tls');
var net  = require('net');
var sysu = require('util');
var util = require('./util');
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
 * @config {Function} [errorCallback] A callback which accepts 2 parameters (err, notification). Recommended when using enhanced format.
 * @config {Number} [cacheLength=100] Number of notifications to cache for error purposes (See Readme)
 * @config {Boolean} [autoAdjustCache=false] Whether the cache should grow in response to messages being lost after errors. (Will still emit a 'cacheTooSmall' event)
 * @config {Number} [connectionTimeout=0] The duration the socket should stay alive with no activity in milliseconds. 0 = Disabled.
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
		errorCallback: undefined,
		cacheLength: 100,
		autoAdjustCache: true,
		connectionTimeout: 0
	};
	
	util.extend(this.options, options);
	
	this.certData = null;
	this.keyData  = null;
	this.pfxData = null;
	
	this.deferredInitialize = null;
	this.deferredConnection = null;
	
	this.currentId = 0;
	this.cachedNotifications = [];
	this.notificationBuffer  = [];

	events.EventEmitter.call(this);
};

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
	
	if(this.options.pfx != null || this.options.pfxData != null) {
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
 * You should never need to call this method, initialisation and connection is handled by {@link Connection#sendNotification}
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
		socketOptions.socket = new net.Stream();

		this.socket = tls.connect(
			this.options['port'],
			this.options['gateway'],
			socketOptions,
			function () {
				debug("Connection established");
				this.emit('connected');
				this.deferredConnection.resolve();
			}.bind(this));
		

		this.socket.setNoDelay(false);
		this.socket.setTimeout(this.options.connectionTimeout);

		this.socket.on("error", this.errorOccurred.bind(this));
		this.socket.on("timeout", this.socketTimeout.bind(this));
		this.socket.on("data", this.handleTransmissionError.bind(this));
		this.socket.on("drain", this.socketDrained.bind(this));
		this.socket.on("clientError", this.errorOccurred.bind(this));
		this.socket.once("close", this.restartConnection.bind(this));

		this.socket.socket.connect(this.options['port'], this.options['gateway']);
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
Connection.prototype.errorOccurred = function(err) {
	debug("Socket error occurred", err);
	this.emit('socketError', err);
	if(!this.deferredConnection.promise.isResolved()) {
		this.deferredConnection.reject(err);
	}
	else {
		this.raiseError(err, null);
	}
	this.destroyConnection();
};

/**
 * @private
 */
Connection.prototype.socketDrained = function() {
	debug("Socket drained");
	if(this.options.enhanced) {
		var notification = this.cachedNotifications[this.cachedNotifications.length - 1];
		this.emit('transmitted', notification);
	}
	if (this.socket && (this.socket.socket.bufferSize != 0 || !this.socket.writable)) {
		return;
	}
	debug("Socket writeable");
	if (this.notificationBuffer.length > 0) {
		debug("Sending notification from buffer");
		this.sendNotification(this.notificationBuffer.shift());
	}
};

/**
 * @private
 */
 Connection.prototype.socketTimeout = function() {
 	debug("Socket timeout");
 	this.emit('timeout');
 	this.socket.end();
 };

/**
 * @private
 */
Connection.prototype.destroyConnection = function() {
	debug("Destroying connection");
	if (this.socket) {
		this.socket.destroy();
	}
};

/**
 * @private
 */
Connection.prototype.restartConnection = function() {
	debug("Restarting connection");
	if (this.socket) {
		this.socket.removeAllListeners();
	}
	
	if(!this.deferredConnection.promise.isResolved()) {
		debug("Connection error occurred before TLS Handshake");
		this.deferredConnection.reject(new Error("Unable to connect"));
	}

	this.emit('disconnected');
	
	this.socket = undefined;
	this.deferredConnection = undefined;
	
	if (this.notificationBuffer.length) {
		debug("Notification queue has %d items, resending the first", this.notificationBuffer.length);
		this.sendNotification(this.notificationBuffer.shift());
	}
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
Connection.prototype.cacheNotification = function (notification) {
	this.cachedNotifications.push(notification);
	if (this.cachedNotifications.length > this.options.cacheLength) {
		debug("Clearing notification %d from the cache", this.cachedNotifications[0]['_uid']);
		this.cachedNotifications.shift();
	}
};

/**
 * @private
 */
Connection.prototype.handleTransmissionError = function (data) {
	if (data[0] == 8) {
		if (!this.options.enhanced) {
			return;
		}
		
		var errorCode = data[1];
		var identifier = data.readUInt32BE(2);
		var notification = undefined;
		var foundNotification = false;
		var temporaryCache = [];
		
		debug("Notification %d caused an error: %d", identifier, errorCode);
		
		while (this.cachedNotifications.length) {
			notification = this.cachedNotifications.shift();
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
			this.emit('transmissionError', errorCode, notification);
			this.raiseError(errorCode, notification);
		}
		else {
			this.cachedNotifications = temporaryCache;

			if(this.cachedNotifications.length > 0) {
				var differentialSize = this.cachedNotifications[0]['_uid'] - notification['_uid']
				this.emit('cacheTooSmall', differentialSize);
				if(this.options.autoAdjustCache) {
					this.options.cacheLength += differentialSize * 2;
				}
			}

			this.emit('transmissionError', Errors["none"], null);
			this.raiseError(errorCode, null);
		}
		
		var count = this.cachedNotifications.length;
		debug("Buffering %d notifications", count);
		for (var i = 0; i < count; ++i) {
			notification = this.cachedNotifications.shift();
			this.bufferNotification(notification);
		}
	}
};

/**
 * @private
 */
Connection.prototype.raiseError = function(errorCode, notification) {
	debug("Raising error:", errorCode, notification);

	if(errorCode instanceof Error) {
		debug("Error occurred with trace:", errorCode.stack);
	}

	if (notification && typeof notification.errorCallback == 'function' ) {
		notification.errorCallback(errorCode);
	} else if (typeof this.options.errorCallback == 'function') {
		this.options.errorCallback(errorCode, notification);
	}
};

/**
 * Send a notification to the APN service
 * @param {Notification} notification The notification object to be sent
 */
Connection.prototype.sendNotification = function (notification) {
	var token = notification.device.token;
	
	var encoding = notification.encoding || 'utf8';
	var message = JSON.stringify(notification);
	var messageLength = Buffer.byteLength(message, encoding);
	var position = 0;
	var data;

	if (token === undefined) {
		process.nextTick(function () {
			this.raiseError(Errors['missingDeviceToken'], notification);
		}.bind(this));
		return Errors['missingDeviceToken'];
	}
	if (messageLength > 255) {
		process.nextTick(function () {
			this.raiseError(Errors['invalidPayloadSize'], notification);
		}.bind(this));
		return Errors['invalidPayloadSize'];
	}

	this.connect().then(function() {
		debug("Sending notification");
		if (!this.socket || this.socket.socket.bufferSize !== 0 || !this.socket.writable) {
			this.bufferNotification(notification);
			return;
		}
	
		notification._uid = this.currentId++;
		if (this.currentId > 0xffffffff) {
			this.currentId = 0;
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
			data.writeUInt32BE(notification.expiry, position);
			position += 4;
	
			this.cacheNotification(notification);
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

		if(this.socket.write(data)) {
			this.socketDrained();
		}
	}.bind(this)).fail(function (error) {
		this.bufferNotification(notification);
		this.raiseError(error, notification);
	}.bind(this));

	return 0;
};

module.exports = Connection;

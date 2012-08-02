var Errors = require('./errors');

var fs   = require('fs');
var q    = require('q');
var tls  = require('tls');
var util = require('./util');
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
 * @config {String} [passphrase] The passphrase for the connection key, if required
 * @config {Buffer[]|String[]} [ca] An array of strings or Buffers of trusted certificates. If this is omitted several well known "root" CAs will be used, like VeriSign. - You may need to use this as some environments don't include the CA used by Apple
 * @config {String} [gateway="gateway.push.apple.com"] The gateway server to connect to.
 * @config {Number} [port=2195] Gateway port
 * @config {Boolean} [enhanced=true] Whether to use the enhanced notification format (recommended)
 * @config {Function} [errorCallback] A callback which accepts 2 parameters (err, notification). Recommended when using enhanced format.
 * @config {Number} [cacheLength] Number of notifications to cache for error purposes (See Readme)
 */
function Connection (options) {

	this.options = {
		cert: 'cert.pem',
		certData: null,
		key: 'key.pem',
		keyData: null,
		passphrase: null,
		ca: null,
		gateway: 'gateway.push.apple.com',
		port: 2195,
		enhanced: true,
		errorCallback: undefined,
		cacheLength: 100
	};
	
	util.extend(this.options, options);
	
	this.certData = null;
	this.keyData  = null;
	
	this.deferredInitialize = null;
	this.deferredConnection = null;
	
	this.currentId = 0;
	this.cachedNotifications = [];
	this.notificationBuffer  = [];
	
	this.connectionTimeout = null;
};

/**
 * @private
 */
Connection.prototype.checkInitialized = function () {
	if (this.keyData && this.certData) {
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
		
		socketOptions.key = this.keyData;
		socketOptions.cert = this.certData;
		socketOptions.passphrase = this.options.passphrase;
		socketOptions.ca = this.options.ca;
		
		this.socket = tls.connect(
			this.options['port'],
			this.options['gateway'],
			socketOptions,
			function () {
				if (!this.socket.authorized) {
					this.deferredConnection.reject(this.socket.authorizationError);
					return;
				}
				
				if (this.connectionTimeout) {
					clearTimeout(this.connectionTimeout);
				}
				
				if (this.options.connectionTimeout > 0) {
					this.connectionTimeout = setTimeout(this.destroyConnection.bind(this), this.options.connectionTimeout);
				}
				
				debug("Connection established");
				this.deferredConnection.resolve();
			}.bind(this));
		
		this.socket.on('data', this.handleTransmissionError.bind(this));
		this.socket.on("drain", this.socketDrained.bind(this));
		this.socket.on('clientError', this.errorOccurred.bind(this));
		this.socket.on("error", this.errorOccurred.bind(this));
		this.socket.on("end", this.restartConnection.bind(this));
		this.socket.once('close', this.restartConnection.bind(this));
	}.bind(this)).fail(function (error) {
		debug("Module initialisation error:", error);
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
	
	this.socket = undefined;
	this.deferredConnection = undefined;
	
	if (this.connectionTimeout) {
		clearTimeout(this.connectionTimeout);
	}
	
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
			this.raiseError(errorCode, notification);
		}
		else {
			this.cachedNotifications = temporaryCache;
			this.raiseError(Errors["none"], null);
		}
		
		var count = this.cachedNotifications.length;
		debug("Buffering %d notifications", count);
		for (var i = 0; i < count; ++i) {
			notification = this.cachedNotifications.shift();
			this.bufferNotification(notification);
		}
		
		this.destroyConnection();
	}
};

/**
 * @private
 */
Connection.prototype.raiseError = function(errorCode, notification) {
	debug("Raising error:", errorCode, notification);
	if (typeof this.options.errorCallback == 'function') {
		this.options.errorCallback(errorCode, notification);
	}
};

/**
 * Send a notification to the APN service
 * @param {Notification} notification The notification object to be sent
 */
Connection.prototype.sendNotification = function (notification) {
	this.connect().then(function() {
		debug("Sending notification");
		if (this.socket.socket.bufferSize !== 0 || !this.socket.writable) {
			debug("Buffering notification");
			this.bufferNotification(notification);
			return;
		}
		
		var token = notification.device.token;
		
		var encoding = notification.encoding || 'utf8';
		var message = JSON.stringify(notification);
		var messageLength = Buffer.byteLength(message, encoding);
		var position = 0;
		var data;
	
		if (token === undefined) {
			this.raiseError(Errors['missingDeviceToken'], notification);
			return;
		}
		if (messageLength > 255) {
			this.raiseError(Errors['invalidPayloadSize'], notification);
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
		this.raiseError(error, notification);
	}.bind(this));
};

module.exports = Connection;

var Errors = require('./errors');

var fs   = require('fs');
var q    = require('q');
var tls  = require('tls');
var util = require('./util');

function Connection (optionArgs) {

	this.options = {
		cert: 'cert.pem' /* Certificate file */,
		certData: null,
		key: 'key.pem'	/* Key file */,
		keyData: null,
		passphrase: null,
		ca: null,
		gateway: 'gateway.push.apple.com' /* gateway address */,
		port: 2195 /* gateway port */,
		enhanced: true /* enable enhanced format */,
		errorCallback: undefined /* Callback when error occurs */,
		cacheLength: 100 /* Number of notifications to cache for error purposes */
	};
	
	util.extend(this.options, optionArgs);
	
	this.certData = null;
	this.keyData  = null;
	
	this.deferredInitialize = null;
	this.deferredConnection = null;
	
	this.currentId = 0;
	this.cachedNotifications = [];
	this.notificationBuffer  = [];
	
	this.connectionTimeout = null;
};

Connection.prototype.checkInitialized = function () {
	if (this.keyData && this.certData) {
		this.deferredInitialize.resolve();
	}
};

Connection.prototype.initialize = function () {
	if (this.deferredInitialize) {
		return this.deferredInitialize.promise;
	}
	
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

Connection.prototype.connect = function () {
	if (this.deferredConnection) {
		return this.deferredConnection.promise;
	}
	
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
				
				this.socketDrained();
				this.deferredConnection.resolve();
			}.bind(this));
	
		this.socket.on('data', this.handleTransmissionError.bind(this));
		this.socket.on("drain", this.socketDrained.bind(this));
		this.socket.on("error", this.destroyConnection.bind(this));
		this.socket.on("end", this.restartConnection.bind(this));
		this.socket.once('close', this.restartConnection.bind(this));
	}.bind(this)).fail(function (error) {
		this.deferredConnection.reject(error);	
	}.bind(this));
	
	return this.deferredConnection.promise;
};

Connection.prototype.socketDrained = function() {
	if (this.socket && (this.socket.socket.bufferSize != 0 || !this.socket.writable)) {
		return;
	}
	if (this.notificationBuffer.length > 0) {
		this.sendNotification(this.notificationBuffer.shift());
	}
};

Connection.prototype.destroyConnection = function() {
	if (this.socket) {
		this.socket.destroySoon();
	}
};

Connection.prototype.restartConnection = function() {
	if (this.socket) {
		this.socket.removeAllListeners();
	}
	
	if(!this.deferredConnection.promise.isResolved()) {
		this.deferredConnection.reject(new Error("Unable to connect"));
	}
	
	this.socket = undefined;
	this.deferredConnection = undefined;
	
	if (this.connectionTimeout) {
		clearTimeout(this.connectionTimeout);
	}
	
	if (this.notificationBuffer.length) {
		this.connect();
	}
};

Connection.prototype.bufferNotification = function (notification) {
	this.notificationBuffer.push(notification);
};

Connection.prototype.cacheNotification = function (notification) {
	this.cachedNotifications.push(notification);
	if (this.cachedNotifications.length > this.options.cacheLength) {
		this.cachedNotifications.shift().deferred.resolve();
	}
};

Connection.prototype.handleTransmissionError = function (data) {
	if (data[0] == 8) {
		if (!this.options.enhanced) {
			return;
		}
		
		var errorCode = data[1];
		var identifier = data.readUInt32(2);
		var notification = undefined;
		var foundNotification = false;
		var temporaryCache = [];
		
		while (this.cachedNotifications.length) {
			notification = cachedNotifications.shift();
			if (notification['_uid'] == identifier) {
				foundNotification = true;
				break;
			}
			temporaryCache.push(notification);
		}
		
		// If we haven't found a notification that caused the error then all the notifications must be resent. We should also raise a warning that the cache length isn't sufficient.
		if (foundNotification) {
			while (temporaryCache.length) {
				temporaryCache.shift().promise.resolve();
			}
			this.raiseError(errorCode, notification);
		}
		else {
			this.cachedNotifications = temporaryCache;
		}
		
		var count = this.cachedNotifications.length;
		for (var i = 0; i < count; ++i) {
			notification = this.cachedNotifications.shift();
			this.bufferNotification(notification);
		}
		
		this.destroyConnection();
	}
};

Connection.prototype.raiseError = function(errorCode, notification) {
	notification.errorCode = errorCode;
	if (typeof this.options.errorCallback == 'function') {
		this.options.errorCallback(errorCode, notification);
	}
	notification.deferred.reject(notification);
};

Connection.prototype.sendNotification = function (notification) {
	if (!notification.deferred) {
		notification.deferred = q.defer();
	}
	
	this.connect().then(function() {
		if (this.socket.socket.bufferSize !== 0 || !this.socket.writable) {
			this.bufferNotification(notification);
			return;
		}
		var encoding = 'utf8';
		var token = notification.device.token;
		var message = JSON.stringify(notification);
		var messageLength = Buffer.byteLength(message, encoding);
		var position = 0;
		var data;
		
		if (notification.encoding) {
			encoding = notification.encoding;
		}
	
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
			data[position] = 0;
			position++;
		}
		data.writeUInt16BE(token.length, position);
		position += 2;
		position += token.copy(data, position, 0);
		data.writeUInt16BE(messageLength, position);
		position += 2;
		position += data.write(message, position, encoding);
	
		this.socket.write(data);
		
		if (!this.options.enhanced) {
			notification.deferred.resolve();
		}
	}.bind(this)).fail(function (error) {
		notification.deferred.reject(error);
	});
	
	return notification.deferred.promise;
};

module.exports = Connection;

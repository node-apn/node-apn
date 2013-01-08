var Errors = require('./errors');

var fs	   = require('fs');
var q	   = require('q');
var tls	   = require('tls');
var net	   = require('net');
var sysu   = require('util');
var util   = require('./util');
var events = require('events');
var NotificationBucket = require('./notification-bucket');
var debug = function() {};
if (process.env.DEBUG) {
	try {
		debug = require('debug')('apn');
	} catch (e) {
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
 * @config {Number} [bucketLength=8192] The length of the bucket, which contains multiple notifications to be sent in a single transmission. It'll also be the lifetime of the TLS connection in bytes. So, the value should be upmost 8192 while it's obsreved unexpectable EPIPE errors, possibly caused by the Apple side's implementation, with greater length of written data.
 * @config {Number} [notificationWaitingTime=300] The duration since the latest notification arrival in milliseconds. Each time it exceeds, the content of the bucket will be sent automatically. 0 = Disabled.
 */
function Connection (options) {
	if (false === (this instanceof Connection)) {
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
		connectionTimeout: 0,
		bucketLength: 8192,
		notificationWaitingTime: 300
	};

	util.extend(this.options, options);

	this.certData = null;
	this.keyData = null;
	this.pfxData = null;

	this.deferredInitialize = null;
	this.deferredConnection = q.defer();
	this.deferredConnectionWritable = q.defer();
	this.deferredBucketSendable = q.defer();

	this.currentId = Connection.ID_BEGIN;
	this.connectionState = Connection.STATE_DISCONNECTED;
	this.running = false;
	this.flushTimerId = null;

	this.notificationBuffer = [];

	this.notificationBucket = new NotificationBucket({
		enhanced: this.options.enhanced,
		maxLength: this.options.bucketLength
	});

	events.EventEmitter.call(this);

	if (this.options.debug) {
		setInterval(this.showState.bind(this), 5000);
	}
};

sysu.inherits(Connection, events.EventEmitter);

// connection status
Connection.STATE_DISCONNECTED = 0;
Connection.STATE_CONNECTING = 1;
Connection.STATE_CONNECTED = 2;

// APN identifier for the sentinel command.
Connection.ID_SENTINEL = 0xffffffff;
// end of APN identifier
Connection.ID_BEGIN = 0;
Connection.ID_END = Connection.ID_SENTINEL;

/**
 * Generate next APN identifier.
 * @private
 */
Connection.prototype.getNextId = function () {
	var id = this.currentId++;
	if (Connection.ID_END <= this.currentId) {
		this.currentId = Connection.ID_BEGIN;
	}
	return id;
};

/**
 * @private
 */
Connection.prototype.showState = function () {
    if (!this.options.debug) return;

	var getState = function(defer) {
		if (!defer) return 'null';
		if (defer.promise.isFulfilled()) return 'fulfilled';
		if (defer.promise.isRejected()) return 'rejected';
		return 'promise';
	};

	debug('deferredConnection: %s', getState(this.deferredConnection));
	debug('deferredConnectionWritable: %s', getState(this.deferredConnectionWritable));
	debug('deferredBucketSendable: %s', getState(this.deferredBucketSendable));
};

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

	debug("Initializing module");
	this.deferredInitialize = q.defer();

	if (this.options.pfx != null || this.options.pfxData != null) {
		if (this.options.pfxData) {
			this.pfxData = this.options.pfxData;
		} else {
			fs.readFile(this.options.pfx, function (err, data) {
				if (err) {
					this.deferredInitialize.reject(err);
					return;
				}
				this.pfxData = data;
				this.checkInitialized();
			}.bind(this));
		}
	} else {
		if (this.options.certData) {
			this.certData = this.options.certData;
		} else {
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
		} else {
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
	if (Connection.STATE_DISCONNECTED < this.connectionState) {
		return this.deferredConnection.promise;
	}

	this.connectionState = Connection.STATE_CONNECTING;
	debug("Initializing connection");
	this.deferredConnection = q.defer();
	this.initialize().then(function () {
		var socketOptions = {};

		if (this.pfxData) {
			socketOptions.pfx = this.pfxData;
		} else {
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
				this.connectionState = Connection.STATE_CONNECTED;
				this.deferredConnection.resolve();
				this.deferredConnectionWritable.resolve();
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
		this.connectionState = Connection.STATE_DISCONNECTED;
		this.deferredConnection = q.defer();
	}.bind(this));

	return this.deferredConnection.promise;
};

/**
 * @private
 */
Connection.prototype.errorOccurred = function(err) {
	debug("Socket error occurred", err);
	this.emit('socketError', err);
	if (!this.deferredConnection.promise.isResolved()) {
		this.deferredConnection.reject(err);
	} else {
		this.raiseError(err);
	}
	this.destroyConnection();
};

/**
 * @private
 */
Connection.prototype.socketDrained = function() {
	debug("Socket drained");
	if (this.options.enhanced) {
		this.emit('transmitted');
	}
	this.deferredConnectionWritable.resolve();
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
	this.showState();
	if (this.socket) {
		this.socket.removeAllListeners();
	}

	if (!this.deferredConnection.promise.isResolved()) {
		debug("Connection error occurred before TLS Handshake");
		this.deferredConnection.reject(new Error("Unable to connect"));
	}

	this.socket = undefined;
	this.connectionState = Connection.STATE_DISCONNECTED;
	this.deferredConnection = q.defer();

	this.deferredConnectionWritable.reject();
	this.deferredBucketSendable.reject();
	this.deferredBucketSendable = q.defer();

	if (this.flushBufferedNotifications()) {
		if (0 < this.notificationBucket.notificationCount) {
			this.updateNotificationWaitingTimer();
		}
		this.emitBufferAvailable();
	}

	// Disable `disconnected` event for now since the disconnection is
	// only a planned action of the messaging cycle.
	// If you'll want to make it available again, please consider when
	// to trigger among the above procedures; I'm not sure of it right now.
	//
	//this.emit('disconnected');
};

/**
 * @private
 */
Connection.prototype.bufferNotification = function (compiledNotification, deviceToken) {
	debug('bufferNotification');
	this.notificationBuffer.push({ compiledNotification: compiledNotification, token: deviceToken });
};

/**
 * Flush buffered notifications as much as possible.
 * @private
 * @return boolean	True if the bucket has been flushed completely. False if there left one or more notifications in the bucket.
 */
Connection.prototype.flushBufferedNotifications = function () {
	debug('flushBufferedNotifications');
	this.showState();
	if (this.notificationBuffer.length === 0) {
		debug('flushBufferedNotifications: empty');
		return true;
	}

	var end = this.notificationBuffer.length;
	for (var i = 0; i < end; ++i) {
		var entry = this.notificationBuffer[i];

		var requiredLength = this.notificationBucket.calculateNotificationLength(
            entry.compiledNotification, entry.token);
		requiredLength += this.notificationBucket.sentinelNotificationLength();

		if (this.notificationBucket.availableLength() < requiredLength) {
			break;
		}

		// add the notification to the buffer.
		this.notificationBucket.appendToBuffer(entry.compiledNotification, entry.token, this.getNextId());

		if (this.notificationBucket.availableLength() < requiredLength) {
			// If the buffer doesn't have enough space for the next one, send the entire buffer in advance.
			break;
		}
	}
	this.notificationBuffer.splice(0, i);

	if (i === end) {
		this.notificationBucket.appendSentinelNotification(Connection.ID_SENTINEL);
		this.deferredBucketSendable.resolve();
		return false;
	}

	return true;
}

/**
 * @private
 */
Connection.prototype.handleTransmissionError = function (data) {
	debug('handleTransmissionError');
	if (data[0] != 8) {
		debug("received unknown command: %d", data[0]);
		return;
	}

	var sentCount = this.notificationBucket.notificationCount;
	if (!this.options.enhanced) {
		this.notificationBucket.clear();
		this.emit('sent', sentCount);
		return;
	}

	var errorCode = data[1];
	var identifier = data.readUInt32BE(2);

	if (identifier === Connection.ID_SENTINEL) {
		debug("All notifications sent successfully");
		this.notificationBucket.clear();
		this.emit('sent', sentCount);
		return;
	}

	var purgedCount = this.notificationBucket.purgeNotificationUntil(identifier);
	if (purgedCount !== false) {
		debug("Notification %d caused an error: %d", identifier, errorCode);
		sentCount = purgedCount;
	} else {
		debug("cannot find invalid notification %d for an error: %d", identifier, errorCode);
		this.notificationBucket.clear(); // to prevent sending same notification to same users
	}
	this.emit('sent', sentCount);
	this.emit('transmissionError', errorCode);
	this.raiseError(errorCode);
};

/**
 * @private
 */
Connection.prototype.raiseError = function(errorCode) {
	debug("Raising error:", errorCode);

	if (errorCode instanceof Error) {
		debug("Error occurred with trace:", errorCode.stack);
	}

	if (typeof this.options.errorCallback == 'function') {
		this.options.errorCallback(errorCode);
	}
};

/**
 * @private
 */
Connection.prototype.emitBufferAvailable = function () {
	process.nextTick(function () {
		debug('emit bucketAvailable');
		if (!this.deferredBucketSendable.promise.isResolved()) {
			this.emit('bucketAvailable',
					  this.notificationBucket.notificationCount,
					  this.notificationBucket.availableLength());
		}
	}.bind(this));
};

/**
 * @private
 */
Connection.prototype.isSocketWritable = function () {
	return this.socket && this.socket.socket.bufferSize === 0 && this.socket.writable;
};

/**
 * @private
 */
Connection.prototype.ensureConnectionWritable = function () {
	debug('ensureConnectionWritable()');
	this.deferredConnectionWritable = q.defer();
	if (this.isSocketWritable()) {
		this.deferredConnectionWritable.resolve();
	}
	return this.deferredConnectionWritable.promise;
};

/**
 * @private
 */
Connection.prototype.ensureBucketSendable = function () {
	debug('ensureBucketSendable()');
	return this.deferredBucketSendable.promise;
};

/**
 * @private
 */
Connection.prototype.updateNotificationWaitingTimer = function () {
	if (this.options.notificationWaitingTime <= 0) return;

	debug('updateNotificationWaitingTimer');
	if (this.flushTimerId) {
		clearTimeout(this.flushTimerId);
	}

	this.flushTimerId = setTimeout(function () {
		this.flushTimerId = null;
		this.flush();
	}.bind(this), this.options.notificationWaitingTime);
};

/**
 * @private
 */
Connection.prototype.clearNotificationWaitingTimer = function () {
	if (this.flushTimerId) {
		clearTimeout(this.flushTimerId);
		this.flushTimerId = null;
	}
};

/**
 * @private
 */
Connection.prototype.run = function () {
	if (this.running) return;
	this.running = true;

	var self = this;
	var transmitNotification = function () {
		debug('transmitNotification()');
		self.showState();
		self.socket.write(self.notificationBucket.getBuffer());
		self.deferredBucketSendable = q.defer();
		self.clearNotificationWaitingTimer();
	};

	var isAllGreen = function () {
		debug('isAllGreen()');
		self.showState();
		if (!self.deferredConnection.promise.isFulfilled()) return false;
		if (!self.deferredConnectionWritable.promise.isFulfilled()) return false;
		return true;
	};

	var runLoop = function () {
		debug('runLoop');
		self.showState();
		q.all([self.connect(), self.ensureConnectionWritable(), self.ensureBucketSendable()]).then(
			function () {
				if (!isAllGreen()) return;
				transmitNotification();

				var deferred = q.defer();
				self.once('sent', function() {
					deferred.resolve();
				});
				return deferred.promise;
			},
			function (error) {
				// content of the `error` should mean nothing here,
				// just it tells we need to rerun the loop
				debug('runLoop->all caught an error:', error);
				return q.delay(10); // prevent a busy loop
			}
		).fail(function (error) {
			self.raiseError(error);
			return q.delay(10); // prevent a busy loop
		}).fin(function () {
			runLoop();
		});
	};

	runLoop();
};

/**
 * Broadcast same notification content to a bunch of devices via the APN service.
 * @param {Notification|Object} notification The notification or compiled one.
 * @param {Function} callback A callback to traverse device tokens, will be called with no argument. The callback should return string while there is destination, or false if it reaches to the end.
 */
Connection.prototype.broadcast = function (notification, callback) {
	debug('broadcast');
	this.showState();
	this.run();

	var compiledNotification;
	if (notification.isCompiled) {
		compiledNotification = notification;
	} else {
		compiledNotification = notification.getCompiledNotification();
	}

	var self = this;
	(function pullTokenAndAddNotification() {
		var token = callback();

		if (token === false) {
			self.flush();
			return;
		}
		self.once('bucketAvailable', pullTokenAndAddNotification);
		self.addNotification(compiledNotification, token);
	})();
};

/**
 * Add a notification to the bucket.
 * When the bucket gets full or exceeded the time limit, it will push the bucket contents to the APN.
 * @param {Notification|Object} notification The notification or compiled one.
 * @param {String|Buffer} token A device token, a destination.
 */
Connection.prototype.addNotification = function (notification, token) {
	debug('addNotification');
	this.showState();
	this.run();

	if (typeof token == "string") {
		token = new Buffer(token.replace(/\s/g, ""), "hex");
	}

	var compiledNotification;
	if (notification.isCompiled) {
		compiledNotification = notification;
	} else {
		compiledNotification = notification.getCompiledNotification();
	}

	if (this.deferredBucketSendable.promise.isResolved()) {
		this.bufferNotification(compiledNotification, token);
		return;
	}

	var requiredLength = this.notificationBucket.calculateNotificationLength(compiledNotification, token);
	requiredLength += this.notificationBucket.sentinelNotificationLength();

	if (this.notificationBucket.availableLength() < requiredLength) {
		// If there is no room for the notification, send the entire buffer first.
		this.bufferNotification(compiledNotification, token);
		this.notificationBucket.appendSentinelNotification(Connection.ID_SENTINEL);
		this.deferredBucketSendable.resolve();
		return;
	}

	// add the notification to the buffer.
	this.notificationBucket.appendToBuffer(compiledNotification, token, this.getNextId());

	if (this.notificationBucket.availableLength() < requiredLength) {
		// If the buffer doesn't have enough space for the next one, send the entire buffer in advance.
		this.notificationBucket.appendSentinelNotification(Connection.ID_SENTINEL);
		this.deferredBucketSendable.resolve();
		return;
	}

	this.updateNotificationWaitingTimer();
	this.emitBufferAvailable();
};

/**
 * Send notifications in the bucket immediately to flush the bucket.
 * It will be sent only when the transmission is in idle time. If you want to flush completely, handle `connected` event and call this until the bucket gets empty.
 * @return {true|Number} True if the flush procuedure starts. Or it returns count of unsent notifications.
 */
Connection.prototype.flush = function () {
	debug('flush()');

	if (this.notificationBucket.notificationCount < 1) {
		return 0;
	}
	if (this.deferredBucketSendable.promise.isResolved()) {
		this.notificationBucket.notificationCount;
	}

	this.notificationBucket.appendSentinelNotification(Connection.ID_SENTINEL);
	this.deferredBucketSendable.resolve();
	return true;
};

module.exports = Connection;

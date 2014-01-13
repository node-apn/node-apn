var Device = require('./device');
var Errors = require('./errors');

var fs   = require('fs');
var q    = require('q');
var tls  = require('tls');
var sysu = require('util');
var util = require('./util');
var events = require('events');
var debug = function() {};
if(process.env.DEBUG) {
	try {
		debug = require('debug')('apnfb');
	}
	catch (e) {
		console.log("Notice: 'debug' module is not available. This should be installed with `npm install debug` to enable debug messages", e);
		debug = function() {};
	}
}
/**
 * Create a new connection to the APN Feedback.
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
 * @config {String} [address="feedback.push.apple.com"] The feedback server to connect to.
 * @config {Number} [port=2196] Feedback server port
 * @config {Function} [feedback] Deprecated ** A callback which accepts 2 parameters (timestamp, {@link Device}) or an array of (timestamp, {@link Device}) object tuples, depending on the value of batchFeedback option. See: {@link <a href="https://developer.apple.com/library/ios/#documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CommunicatingWIthAPS/CommunicatingWIthAPS.html#//apple_ref/doc/uid/TP40008194-CH101-SW3">Communicating with APS</a>.
 * @config {Boolean} [batchFeedback=true] If true, the feedback callback should only be called after all tokens are received, with an array of timestamp and device token tuples.
 * @config {Number} [batchSize=0] The maximum number of tokens to pass when emitting the event. After `batchSize` tokens are received the `feedback` event will be emitted.
 * @config {Function} [errorCallback] Deprecated ** Callback which will capture connection errors
 * @config {Number} [interval=3600] Interval to automatically connect to the Feedback service.
 */
function Feedback(options) {

	this.options = {
		cert: 'cert.pem',					/* Certificate file */
		certData: null,						/* Certificate data */
		key: 'key.pem',						/* Key file */
		keyData: null,						/* Key data */
		ca: null,							/* Certificate Authority */
		pfx: null,							/* PFX File */
		pfxData: null,						/* PFX Data */
		passphrase: null,                   /* Passphrase for key */
		address: 'feedback.push.apple.com',	/* feedback address */
		port: 2196,							/* feedback port */
		rejectUnauthorized: true,			/* Set this to false incase using a local proxy, reject otherwise */
		feedback: false,					/* **Deprecated**: Use `feedback` event instead, enable feedback service, set to callback */
		batchFeedback: true,				/* If the feedback callback should only be called after all tokens are received. */
		batchSize: 0,						/* The maximum number of tokens to pass when emitting the `feedback` event, by default pass all tokens when connection closes. */
		errorCallback: false,				/* error handler to catch connection exceptions */
		interval: 3600						/* interval in seconds to connect to feedback service */
	};

	util.extend(this.options, options);

	this.certData = null;
	this.keyData = null;
	this.pfxData = null;

	this.deferredInitialize = null;
	this.deferredConnection = null;

	this.readBuffer = null;
	this.interval = null;

	events.EventEmitter.call(this);

	if (typeof this.options.errorCallback == 'function') {
		this.on('error', this.options.errorCallback);
	}

	if (typeof this.options.feedback == 'function') {
		this.on('feedback', this.options.feedback);
	}

	process.nextTick(function() {
		if(this.listeners('feedback').length === 0) {
			debug("WARNING: A `feedback` listener has not been specified. Data may be lost.");
		}
	}.bind(this));

	this.start();
}

sysu.inherits(Feedback, events.EventEmitter);

/**
 * @private
 */
Feedback.prototype.checkInitialized = function () {
	if ((this.keyData && this.certData) || this.pfxData) {
		this.deferredInitialize.resolve();
	}
};

/**
 * @private
 */
Feedback.prototype.initialize = function () {
	if (this.deferredInitialize) {
		return this.deferredInitialize.promise;
	}

	debug("Initialising module");
	this.deferredInitialize = q.defer();

	if (this.options.pfx !== null || this.options.pfxData !== null) {
		if (this.options.pfxData) {
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
 * You should call {@link Feedback#start} instead of this method
 * @private
 */
Feedback.prototype.connect = function () {
	if(this.deferredConnection) {
		return this.deferredConnection.promise;
	}

	debug("Initialising connection");
	this.deferredConnection = q.defer();
	this.initialize().then(function() {
		var socketOptions = {};

		if (this.pfxData !== null) {
			socketOptions.pfx = this.pfxData;
		}
		else {
			socketOptions.key = this.keyData;
			socketOptions.cert = this.certData;
			socketOptions.ca = this.options.ca;
		}
		socketOptions.passphrase = this.options.passphrase;
		socketOptions.rejectUnauthorized = this.options.rejectUnauthorized;

		this.socket = tls.connect(
			this.options['port'],
			this.options['address'],
			socketOptions,
			function () {
				debug("Connection established");
				this.deferredConnection.resolve();
			}.bind(this));

		this.readBuffer = new Buffer(0);
		this.feedbackData = [];
		this.socket.on('data', this.receive.bind(this));
		this.socket.on("error", this.destroyConnection.bind(this));
		this.socket.once('close', this.resetConnection.bind(this));
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
Feedback.prototype.receive = function (data) {
	var time = 0;
	var tokenLength = 0;
	var token = null;

	debug("Received packet of length: %d", data.length);
	var newBuffer = new Buffer(this.readBuffer.length + data.length);
	this.readBuffer.copy(newBuffer);
	data.copy(newBuffer, this.readBuffer.length);
	this.readBuffer = newBuffer;
	while (this.readBuffer.length > 6) {
		time = this.readBuffer.readUInt32BE(0);
		tokenLength = this.readBuffer.readUInt16BE(4);
		if ((this.readBuffer.length - 6) < tokenLength) {
			return;
		}
		token = new Buffer(tokenLength);
		this.readBuffer.copy(token, 0, 6, 6 + tokenLength);

		debug("Parsed device token: %s, timestamp: %d", token.toString("hex"), time);
		var device = new Device(token);
		if (!this.options.batchFeedback) {
			debug("Emitting feedback event");
			this.emit('feedback', time, device);
		} else {
			this.feedbackData.push({ time: time, device: device });
			if (this.options.batchSize > 0 && this.options.batchSize <= this.feedbackData.length) {
				this.emit('feedback', this.feedbackData);
				this.feedbackData = [];
			}
		}
		this.readBuffer = this.readBuffer.slice(6 + tokenLength);
	}
};

/**
 * @private
 */
Feedback.prototype.destroyConnection = function (err) {
	debug("Destroying connection");
	if(err) {
		this.emit('feedbackError', err);
	}
	if (this.socket) {
		this.socket.destroySoon();
	}
};

/**
 * @private
 */
Feedback.prototype.resetConnection = function () {
	debug("Resetting connection");

	if (this.options.batchFeedback && this.feedbackData.length > 0) {
		debug("Emitting all feedback tokens");
		this.emit('feedback', this.feedbackData);
		this.feedbackData = [];
	}

	if(this.deferredConnection.promise.isPending()) {
		debug("Connection error occurred before TLS Handshake");
		this.deferredConnection.reject(new Error("Unable to connect"));
	}

	this.socket = null;
	this.deferredConnection = null;
};

/**
 * Connect to the feedback service, also initialise the timer if an interval is specified.
 */
Feedback.prototype.start = function () {
	debug("Starting feedback service");
	this.cancel();
	if (this.options.interval > 0) {
		debug("Feedback service interval set at: %d", this.options.interval);
		this.interval = setInterval(this.request.bind(this), this.options.interval * 1000);
	}
	this.request();
};

/**
 * @private
 */
Feedback.prototype.request = function () {
	debug("Performing feedback request");
	this.connect().fail(function (error) {
		this.emit('feedbackError');
	}.bind(this));
};

/**
 * Cancel the timer to stop the Feedback service periodically connecting.
 */
Feedback.prototype.cancel = function () {
	debug("Cancelling feedback interval");
	if (this.interval !== undefined) {
		clearInterval(this.interval);
	}
};

module.exports = Feedback;

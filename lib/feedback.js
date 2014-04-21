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
 * @config {Buffer|String} [cert="cert.pem"] The filename of the connection certificate to load from disk, or a Buffer/String containing the certificate data.
 * @config {Buffer|String} [key="key.pem"] The filename of the connection key to load from disk, or a Buffer/String containing the key data.
 * @config {Buffer[]|String[]} [ca] An array of trusted certificates. Each element should contain either a filename to load, or a Buffer/String to be used directly. If this is omitted several well known "root" CAs will be used. - You may need to use this as some environments don't include the CA used by Apple (entrust_2048).
 * @config {Buffer|String} [pfx] File path for private key, certificate and CA certs in PFX or PKCS12 format, or a Buffer/String containing the PFX data. If supplied will be used instead of certificate and key above.
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
		key: 'key.pem',						/* Key file */
		ca: null,							/* Certificate Authority */
		pfx: null,							/* PFX File */
		passphrase: null,                   /* Passphrase for key */
		production: (process.env.NODE_ENV === "production"),
		port: 2196,							/* feedback port */
		rejectUnauthorized: true,			/* Set this to false incase using a local proxy, reject otherwise */
		feedback: false,					/* **Deprecated**: Use `feedback` event instead, enable feedback service, set to callback */
		batchFeedback: true,				/* If the feedback callback should only be called after all tokens are received. */
		batchSize: 0,						/* The maximum number of tokens to pass when emitting the `feedback` event, by default pass all tokens when connection closes. */
		errorCallback: false,				/* error handler to catch connection exceptions */
		interval: 3600						/* interval in seconds to connect to feedback service */
	};

	util.extend(this.options, options);

	if (this.options.address == null) {
		if (this.options.production) {
			this.options.address = "feedback.push.apple.com";
		}
		else {
			this.options.address = "feedback.sandbox.push.apple.com";
		}
	}

	this.initializationPromise = null;
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
 * You should never need to call this method, initialization and connection is handled by {@link Connection#sendNotification}
 * @private
 */
Feedback.prototype.initialize = function () {
	if (this.initializationPromise) {
		return this.initializationPromise;
	}

	debug("Initialising module");
	var readFile = q.nfbind(fs.readFile);

	// Prepare PKCS#12 data if available
	// Prepare PKCS#12 data if available
	var pfxPromise = null;
	if(this.options.pfx !== null || this.options.pfxData !== null) {
		if(this.options.pfxData) {
			pfxPromise = this.options.pfxData;
		}
		else if(Buffer.isBuffer(this.options.pfx)) {
			pfxPromise = this.options.pfx;
		}
		else if(this.options.pfx){
			pfxPromise = readFile(this.options.pfx);
		}
	}

	// Prepare Certificate data if available.
	var certPromise = null;
	if(this.options.cert !== null || this.options.certData !== null) {
		if (this.options.certData) {
			certPromise = this.options.certData;
		}
		else if(Buffer.isBuffer(this.options.key) || checkPEMType(this.options.cert, "CERTIFICATE")) {
			certPromise = this.options.cert;
		}
		else if (this.options.cert){
			// Nothing has matched so attempt to load from disk
			certPromise = readFile(this.options.cert);
		}
	}
	// Prepare Key data if available
	var keyPromise = null;
	if(this.options.key !== null || this.options.keyData !== null) {
		if (this.options.keyData) {
			keyPromise = this.options.keyData;
		}
		else if(Buffer.isBuffer(this.options.key) || checkPEMType(this.options.key, "PRIVATE KEY")) {
			keyPromise = this.options.key;
		}
		else if(this.options.key) {
			keyPromise = readFile(this.options.key);
		}
	}

	// Prepare Certificate Authority data if available.
	var caPromises = [];
	if (this.options.ca != null && !sysu.isArray(this.options.ca)) {
		this.options.ca = [ this.options.ca ];
	}
	for(var i in this.options.ca) {
		var ca = this.options.ca[i];
		if(Buffer.isBuffer(ca) || checkPEMType(ca, "CERTIFICATE")) {
			caPromises.push(ca);
		}
		else {
			caPromises.push(readFile(ca));
		}
	}
	if (caPromises.length == 0) {
		caPromises = undefined;
	}
	else {
		caPromises = q.all(caPromises);
	}

	this.initializationPromise = q.all([pfxPromise, certPromise, keyPromise, caPromises]);
	return this.initializationPromise;
};

function checkPEMType(input, type) {
	if (input == null) {
		return false;
	}

	var matches = input.match(/\-\-\-\-\-BEGIN ([A-Z\s*]+)\-\-\-\-\-/);

	if (matches != null) {
		return matches[1].indexOf(type) > 0;
	}
	return false;
}

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
	this.initialize().spread(function(pfxData, certData, keyData, caData) {
		var socketOptions = {};

		socketOptions.pfx = pfxData;
		socketOptions.cert = certData;
		socketOptions.key = keyData;
		socketOptions.ca = caData;
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

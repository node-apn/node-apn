var Device = require('./device');
var Errors = require('./errors');

var fs   = require('fs');
var q    = require('q');
var tls  = require('tls');
var util = require('./util');
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
 * @config {String} [passphrase] The passphrase for the connection key, if required
 * @config {Buffer[]|String[]} [ca] An array of strings or Buffers of trusted certificates. If this is omitted several well known "root" CAs will be used, like VeriSign. - You may need to use this as some environments don't include the CA used by Apple
 * @config {String} [address="feedback.push.apple.com"] The feedback server to connect to.
 * @config {Number} [port=2195] Feedback server port
 * @config {Function} [feedback] A callback which accepts 2 parameters (timestamp, {@link Device}). See: {@link <a href="https://developer.apple.com/library/ios/#documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CommunicatingWIthAPS/CommunicatingWIthAPS.html#//apple_ref/doc/uid/TP40008194-CH101-SW3">Communicating with APS</a>.
 * @config {Function} [errorCallback] Callback which will capture connection errors
 * @config {Number} [interval=3600] Interval to automatically connect to the Feedback service.
 */
function Feedback(options) {

	this.options = {
		cert: 'cert.pem',					/* Certificate file */
		certData: null,						/* Certificate data */
		key: 'key.pem',						/* Key file */
		keyData: null,						/* Key data */
		passphrase: null,                   /* Passphrase for key */
		ca: null,							/* Certificate Authority
		address: 'feedback.push.apple.com',	/* feedback address */
		port: 2196,							/* feedback port */
		feedback: false,					/* enable feedback service, set to callback */
		errorCallback: false,				/* error handler to catch connection exceptions */
		interval: 3600,						/* interval in seconds to connect to feedback service */
	};
	
	util.extend(this.options, options);
	
	this.certData = null;
	this.keyData = null;
	
	this.deferredInitialize = null;
	this.deferredConnection = null;
	
	this.readBuffer = null;
	this.interval = null;

	if (typeof this.options.feedback != 'function') {
		throw new Error(-1, 'A callback function must be specified');
	}
	
	this.start();
};

/**
 * @private
 */
Feedback.prototype.checkInitialized = function () {
	if (this.keyData && this.certData) {
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
		
		socketOptions.key = this.keyData;
		socketOptions.cert = this.certData;
		socketOptions.passphrase = this.options.passphrase;
		socketOptions.ca = this.options.ca;
		
		this.socket = tls.connect(
			this.options['port'],
			this.options['address'],
			socketOptions,
			function () {
				if (!this.socket.authorized) {
					this.deferredConnection.reject(this.socket.authorizationError);
					this.deferredConnection = null;
				}
				
				debug("Connection established");
				this.deferredConnection.resolve();
			}.bind(this));
			
		this.readBuffer = new Buffer(0);
		this.socket.on('data', this.receive.bind(this));
		this.socket.on("error", this.destroyConnection.bind(this));
		this.socket.once('close', this.resetConnection.bind(this));
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
		if (typeof this.options.feedback == 'function') {
			debug("Calling feedback method for device");
			this.options.feedback(time, new Device(token));
		}
		this.readBuffer = this.readBuffer.slice(6 + tokenLength);
	}
}

/**
 * @private
 */
Feedback.prototype.destroyConnection = function () {
	debug("Destroying connection");
	if (this.socket) {
		this.socket.destroySoon();
	}
};

/**
 * @private
 */
Feedback.prototype.resetConnection = function () {
	debug("Resetting connection");
	if (this.socket) {
		this.socket.removeAllListeners();
	}
	
	if(!this.deferredConnection.promise.isResolved()) {
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
		if(typeof this.options.errorCallback == "function") {
			this.options.errorCallback(error);
		}
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
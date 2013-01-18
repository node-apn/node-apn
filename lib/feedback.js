var Errors = require('./errors');

var fs	 = require('fs');
var q	 = require('q');
var tls	 = require('tls');
var util = require('./util');
var sysu   = require('util');
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
 * @config {Number} [port=2195] Feedback server port
 * @config {Number} [interval=3600] Interval to automatically connect to the Feedback service.
 * @config {String} [tokenType="string"] Type of the `device token` argument of the `feedback` event, "string" or "binary". If it is "binary", the argument will be a `Buffer` object. If it is "string", the argument will be a hex string.
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
		passphrase: null,					/* Passphrase for key */
		address: 'feedback.push.apple.com',	/* feedback address */
		port: 2196,							/* feedback port */
		rejectUnauthorized: true,				/* Set this to false incase using a local proxy, reject otherwise */
		feedback: false,					/* enable feedback service, set to callback */
		errorCallback: false,				/* error handler to catch connection exceptions */
		interval: 3600,						/* interval in seconds to connect to feedback service */
		tokenType: 'string'					/* Type of the `device token` argument of the `feedback` event */
	};
	
	util.extend(this.options, options);
	
	this.certData = null;
	this.keyData = null;
	this.pfxData = null;
	
	this.deferredInitialize = null;
	this.deferredConnection = null;
	
	this.readBuffer = null;
	this.interval = null;
	this.tokenTypeBinary = false;

	events.EventEmitter.call(this);

	this.start();
};

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
	
	if (this.options.pfx != null || this.options.pfxData != null) {
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
	
	if (this.options.tokenType === 'string') {
		this.tokenTypeBinary = false;
	} else if (this.options.tokenType === 'binary') {
		this.tokenTypeBinary = true;
	} else {
		this.deferredInitialize.reject(new Error('options.tokenType is invalid: ' + this.options.tokenType));
		return;
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
		
		if (this.pfxData != null) {
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
				this.emit('connected');
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
	debug("Received packet of length: %d", data.length);
	var newBuffer = new Buffer(this.readBuffer.length + data.length);
	this.readBuffer.copy(newBuffer);
	data.copy(newBuffer, this.readBuffer.length);
	this.readBuffer = newBuffer;
	var end = this.readBuffer.length;
	var pos = 0;
	while (6 < (end - pos)) {
		var time = this.readBuffer.readUInt32BE(pos);
		var tokenLength = this.readBuffer.readUInt16BE(pos + 4);
		if ((end - pos - 6) < tokenLength) {
			break;
		}
		var token;
		if (this.tokenTypeBinary) {
			token = new Buffer(tokenLength);
			this.readBuffer.copy(token, 0, pos + 6, pos + 6 + tokenLength);
			debug("Parsed device token: %s, timestamp: %d", token.toString('hex'), time);
		} else {
			token = this.readBuffer.toString('hex', pos + 6, pos + 6 + tokenLength);
			debug("Parsed device token: %s, timestamp: %d", token, time);
		}
		pos += 6 + tokenLength;
		this.emit('feedback', time, token);
	}
	if (end < pos) {
		this.readBuffer = this.readBuffer.slice(pos);
	} else {
		this.readBuffer = new Buffer(0);
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
	this.emit('disconnected');
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
		this.emit('error', error);
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

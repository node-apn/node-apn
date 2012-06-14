var Errors = require('./errors');

var fs   = require('fs');
var q    = require('q');
var tls  = require('tls');
var util = require('./util');

function Feedback(optionArgs) {

	this.options = {
		cert: 'cert.pem',					/* Certificate file */
		certData: null,						/* Certificate data */
		key: 'key.pem',						/* Key file */
		keyData: null,						/* Key data */
		passphrase: null,                   /* Passphrase for key */
		address: 'feedback.push.apple.com',	/* feedback address */
		port: 2196,							/* feedback port */
		feedback: false,					/* enable feedback service, set to callback */
		errorCallback: false,				/* error handler to catch connection exceptions */
		interval: 3600,						/* interval in seconds to connect to feedback service */
	};
	
	util.extend(this.options, optionArgs);
	
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

Feedback.prototype.checkInitialized = function () {
	if (this.keyData && this.certData) {
		this.deferredInitialize.resolve();
	}
};

Feedback.prototype.initialize = function () {
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

Feedback.prototype.connect = function () {
	if(this.deferredConnection) {
		return this.deferredConnection.promise;
	}
	this.deferredConnection = q.defer();
	this.initialize().then(function() {
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
					this.deferredConnection = null;
				}
				
				this.deferredConnection.resolve();
			}.bind(this));
			
		this.receiveBuffer = new Buffer(0);
		this.socket.on('data', this.receive.bind(this));
		this.socket.on("error", this.destroyConnection.bind(this));
		this.socket.once('close', this.resetConnection.bind(this));
	}.bind(this)).fail(function (error) {
		this.deferredConnection.reject(error);
		this.deferredConnection = null;
	}.bind(this));
	
	return this.deferredConnection.promise;
};

Feedback.prototype.receive = function (data) {
	var time = 0;
	var tokenLength = 0;
	var token = null;

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
		
		if (typeof this.options.feedback == 'function') {
			this.options.feedback(time, token);
		}
		this.readBuffer = this.readBuffer.slice(6 + tokenLength);
	}
}

Feedback.prototype.destroyConnection = function () {
	if (this.socket) {
		this.socket.destroySoon();
	}
};

Feedback.prototype.resetConnection = function () {
	if (this.socket) {
		this.socket.removeAllListeners();
	}
	this.socket = null;
	this.deferredConnection = null;
}

Feedback.prototype.start = function () {
	this.cancel();
	if (this.options.interval > 0) {
		this.interval = setInterval(this.request.bind(this), this.options.interval * 1000);
	}
	else {
		this.request();
	}
}

Feedback.prototype.request = function () {
	this.connect().fail(function (error) {
		if(typeof this.options.errorCallback == "function") {
			this.options.errorCallback(error);
		}
	}.bind(this));
};

Feedback.prototype.cancel = function () {
	if (this.interval !== undefined) {
		clearInterval(this.interval);
	}
};

module.exports = Feedback;
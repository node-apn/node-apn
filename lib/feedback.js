var Buffer = require('buffer').Buffer;

var Errors = require('./errors');

var fs   = require('fs');
var q    = require('q');
var tls  = require('tls');
var util = require('./util');

var Feedback = function (optionArgs) {
	var self = this;
	var hasKey = false;
	var hasCert = false;
	var socketOptions = {};

	var responsePacketLength = 38;
	var readBuffer = new Buffer(responsePacketLength);
	var readLength = 0;

	var options = {
		cert: 'cert.pem',					/* Certificate file */
		certData: '',						/* Certificate data */
		key: 'key.pem',						/* Key file */
		keyData: '',						/* Key data */
		passphrase: null,                   /* Passphrase for key */
		address: 'feedback.push.apple.com',	/* feedback address */
		port: 2196,							/* feedback port */
		feedback: false,					/* enable feedback service, set to callback */
		interval: 3600,						/* interval in seconds to connect to feedback service */
	};

	if (optionArgs) {
		var keys = Object.keys(options);
		for (var i = 0; i < keys.length; i++) {
			var k = keys[i];
			if (optionArgs[k] !== undefined) options[k] = optionArgs[k];
		}
	}

	if (typeof options['feedback'] != 'function') {
		return Error(-1, 'A callback function must be specified');
	}

	this.readyToConnect = function () {
		return (hasKey && hasCert);
	};

	self.startSocket = function () {
		self.socket = tls.connect(options['port'], options['address'], socketOptions);
		self.socket.pair.on('secure', function () {
			if (!self.socket.authorized) {
				throw self.socket.authorizationError;
			}
		});
		self.socket.on('data', function (data) {
			processData(data);
		});
		self.socket.once('error', function () {
			self.socket.removeAllListeners();
			self.socket = undefined;
		});
		self.socket.once('end', function () {
		});
		self.socket.once('close', function () {
			self.socket.removeAllListeners();
			self.socket = undefined;
		});
	};

	var connect = invoke_after(function () {
		self.startSocket();
	});

	if (options['certData']) {
		socketOptions['cert'] = options['certData'];
		hasCert = true;
	} else {
		fs.readFile(options['cert'], connect(function (err, data) {
			if (err) {
				throw err;
			}
			socketOptions['cert'] = data.toString();
			hasCert = true;
		}));
	}

	if (options['keyData']) {
		socketOptions['key'] = options['keyData'];
		hasKey = true;
	} else {
		fs.readFile(options['key'], connect(function (err, data) {
			if (err) {
				throw err;
			}
			socketOptions['key'] = data.toString();
			hasKey = true;
		}));
	}

	if (options['passphrase']) {
		socketOptions['passphrase'] = options['passphrase'];
	}

	if (options['interval'] > 0) {
		this.interval = setInterval(function () {
			self.request();
		}, options['interval'] * 1000);
	}

	var processData = function (data) {
		var pos = 0;
		// If there is some buffered data, read the remainder and process this first.
		if (readLength > 0) {
			if (data.length < (responsePacketLength - readLength)) {
				data.copy(readBuffer, readLength, 0);
				readLength += data.length;
				return;
			}
			data.copy(readBuffer, readLength, 0, responsePacketLength - readLength);
			decodeResponse(readBuffer, 0);
			pos = responsePacketLength - readLength;
			readLength = 0;
		}
		while (pos < data.length - 1) {
			if ((data.length - pos) < responsePacketLength) {
				//Buffer remaining data until next time
				data.copy(readBuffer, 0, pos);
				readLength = data.length - pos;
				break;
			}
			decodeResponse(data, pos);
			pos += responsePacketLength;
		}
	};
	
	var decodeResponse = function (data, start) {
		var time = util.bytes2int(data, 4, start);
		start += 4;
		var len = util.bytes2int(data, 2, start);
		start += 2;
		var tok = new Buffer(len);
		data.copy(tok, 0, start, start + len);
	
		if (typeof options['feedback'] == 'function') {
			options['feedback'](time, new exports.Device(tok, false));
		}
	}
};

Feedback.prototype.request = function () {
	if ((this.socket === undefined || this.socket.readyState == 'closed') && this.readyToConnect()) {
		this.startSocket();
	}
};

Feedback.prototype.cancel = function () {
	if (this.interval !== undefined) {
		clearInterval(this.interval);
	}
};

exports = Feedback;
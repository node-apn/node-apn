var net = require('net');
var EventEmitter = require('events').EventEmitter;
var crypto = require('crypto');
var sys = require('sys');
var fs = require('fs');
var Buffer = require('buffer').Buffer;

var Connection = function (optionArgs) {
	this.socket = new net.Stream();
	this.credentials = crypto.createCredentials();
	this.currentId = 0;
	this.cachedNotes = [];

	var self = this;
	var hasKey = hasCert = false;
	
	var options =	{ cert: 'cert.pem' /* Certificate file */
					, key:	'key.pem'  /* Key file */
					, gateway: 'gateway.push.apple.com' /* gateway address */
					, port: 2195 /* gateway port */
					, enhanced: false /* enable enhanced format */
					, errorCallback: undefined /* Callback when error occurs */
					, feedback: false /* enable feedback service, set to callback */
					, feedbackInterval: 3600 /* interval in seconds to connect to feedback service */
					, cacheLength: 5 /* Number of notifications to cache for response */
					};
	
	if (optionArgs) {
		var keys = Object.keys(options);
		for (var i = 0; i < keys.length; i++) {
			var k = keys[i];
			if (optionArgs[k] !== undefined) options[k] = optionArgs[k];
		}
	}
		
	var startSocket = function () {
		self.socket.connect(options['port'], options['gateway']);
	}
	
	self.socket.on('connect', function() { console.log("connect."); self.socket.setSecure(self.credentials); });
	self.socket.on('data', function(data) { handleTransmissionError(data); });
	self.socket.on('end', function () { console.log('closed'); self.socket.end(); });
	
	var connect = invoke_after(startSocket);
	
	fs.readFile(options['cert'], connect(function(err, data) {
		if(err) {
			throw err;
		}
		self.credentials.context.setCert(data.toString());
		hasCert = true;
	}));

	fs.readFile(options['key'], connect(function(err, data) {
		if(err) {
			throw err;
		}
		self.credentials.context.setKey(data.toString());
		hasKey = true;
	}));

	this.sendNotification = function (note) {
		var token = note.device.token;
		var message = JSON.stringify(note.payload);
		var messageLength = Buffer.byteLength(message);
		var pos = 0;
		
		// Check notification length here. Return non-zero as error
		
		note._uid = this.currentId++;
		
		if(options.enhanced) {
			var data = new Buffer(1 + 4 + 4 + 2 + token.length + 2 + messageLength);
			// Command
			data[pos] = 1;
			pos++;
			
			// Identifier
			pos += int2buf(note._uid, data, pos, 4);
			
			// Expiry
			pos += int2buf(note.expiry, data, pos, 4);
			
			self.cachedNotes.push(note);
			tidyCachedNotes();
		}
		else {
			var data = new Buffer(1 + 2 + token.length + 2 + messageLength);
			data[pos] = 0;
			pos++;
		}
		
		pos += int2buf(token.length, data, pos, 2);
		pos += token.copy(data, pos, 0);
		pos += int2buf(messageLength, data, pos, 2);
		pos += data.write(message, pos);
		
		// If error occurs then slice array and resend all stored notes.
		
		if(self.socket.readyState != 'open') {
			if(self.socket.readyState == 'closed' && hasKey && hasCert) {
				startSocket();
			}
			self.socket.on('connect', 
				function() { 
					self.socket.write(data); 
					self.socket.removeListener('connect', arguments.callee); 
				});
		}
		else {
			self.socket.write(data);
		}
	}
	
	var tidyCachedNotes = function() {
		// Maybe a timestamp should be stored for each note and kept for a duration?
		if(self.cachedNotes.length > options.cacheLength) {
			self.cachedNotes.shift();
		}
	}
		
	var handleTransmissionError = function(data) {
		// Need to check message that errors
		//	return failed notification to owner
		//	resend all following notifications
		if(data[0] == 8) {
			var currentCache = self.cachedNotes;
			self.cachedNotes = [];
			self.socket.end();
			// This is an error condition
			var errorCode = data[1];
			var identifier = bytes2int(data.slice(2,6), 4);
			var note = undefined;
			while(currentCache.length) {
				note = currentCache.shift();
				if(note['_uid'] == identifier) {
					break;
				}
			}
			// Notify callback of failed notification
			if(errorCallback !== undefined && typeof errorCallback == 'function') {
				errorCallback(errorCode, note);
			}
			while(currentCache.length) {
				note = currentCache.shift();
				self.sendNotification(note);
			}
		}
	}
}

Connection.prototype = new EventEmitter;
Connection.prototype.constructor = Connection;

exports.connection = Connection;

exports.notification = function () {
	this.payload = {aps: {}};
	this.expiry = 0;
	this.identifier = 0;
	this.device;
}

exports.device = function (token) {
	var self = this;
	this.token = parseToken(token);
	
	function parseToken(token) {
		token = token.replace(/\s/g, "");
		length = Number(token.length / 2);
		hexToken = new Buffer(length);
		for(var i=0; i < token.length; i+=2) {
			word = token[i];
			if((i + 1) >= token.length || typeof(token[i+1]) === undefined) {
				word += '0';
			}
			else {
				word += token[i+1];
			}
			hexToken[i/2] = parseInt(word, 16);
		}
		return hexToken;
	}
	
	this.hexToken = function () {
		var out = [],
			len = this.token.length;
		for (var i = 0; i < len; i++) {
			n = this.token[i];
			if (n < 16) out[i] = "0" + n.toString(16);
			else out[i] = n.toString(16);
		}
		return out.join("");
	}
}

exports.feedback = function (optionArgs) {
	this.socket = new net.Stream();
	this.credentials = crypto.createCredentials();

	var self = this;
	var hasKey = hasCert = false;
	
	var options =	{ cert: 'cert.pem' /* Certificate file */
					, key:	'key.pem'  /* Key file */
					, address: 'feedback.push.apple.com' /* feedback address */
					, port: 2196 /* feedback port */
					, feedback: false /* enable feedback service, set to callback */
					, interval: 3600 /* interval in seconds to connect to feedback service */
					};
	
	if (optionArgs) {
		var keys = Object.keys(options);
		for (var i = 0; i < keys.length; i++) {
			var k = keys[i];
			if (optionArgs[k] !== undefined) options[k] = optionArgs[k];
		}
	}
		
	var startSocket = function () {
		self.socket.connect(options['port'], options['address']);
	}
	
	self.socket.on('connect', function() { self.socket.setSecure(self.credentials); });
	self.socket.on('data', function(data) { processData(data); });
	self.socket.on('end', function () { self.socket.end(); });
	
	var connect = invoke_after(startSocket);
	
	fs.readFile(options['cert'], connect(function(err, data) {
		if(err) {
			throw err;
		}
		self.credentials.context.setCert(data.toString());
		hasCert = true;
	}));

	fs.readFile(options['key'], connect(function(err, data) {
		if(err) {
			throw err;
		}
		self.credentials.context.setKey(data.toString());
		hasKey = true;
	}));
	
	this.request = function () {
		if(self.socket.readyState == 'closed') {
			if(!hasKey || !hasCert) {
				// Connection will be made once both key and cert are available
				return;
			}
			startSocket();
		}
	}
	
	this.cancel = function () {
		if(this.interval !== undefined) {
			clearInterval(this.interval);
		}
	}
	
	if(options['interval'] > 0) {
		this.interval = setInterval(this.request, options['interval'] * 1000);
	}
	
	var processData = function(data) {
		
	}
}

function int2buf(number, buffer, start, length) {
	length -= 1;
	for(var i=0; i<=length; i++) {
		buffer[start+length-i] = number & 0xff;
		number = number >> 8;
	}
	return length+1;
}

function bytes2int(bytes, length) {
	var num = 0;
	length -= 1;
	for(var i=0; i<=length; i++) {
		num += (bytes[i] << ((length - i) * 8));
	}
	return num;
}

function invoke_after(callback) {
	var n = 0;
	return function (delegate) {
		n++;
		return function() {
			delegate.apply(delegate, arguments);
			if(--n == 0) callback();
		};
	};
}
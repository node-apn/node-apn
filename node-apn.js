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
		var hexTok = note.device.hexToken();
		var message = JSON.stringify(note.payload);
		var messageLength = Buffer.byteLength(message);
		var pos = 0;
		
		// Check notification length here. Return non-zero as error
		
		note._uid = this.currentId++;
		
		if(options.enhanced) {
			var data = new Buffer(1 + 4 + 4 + 2 + hexTok.length + 2 + messageLength);
			// Command
			data[pos] = 1;
			pos++;
			
			// Identifier
			pos += data.write(int2bytes(note._uid, 4), pos, 'binary');
			
			// Expiry
			pos += data.write(int2bytes(note.expiry, 4), pos, 'binary');
			
			self.cachedNotes.push(note);
			tidyCachedNotes();
		}
		else {
			var data = new Buffer(1 + 2 + hexTok.length + 2 + messageLength);
			data[pos] = 0;
			pos++;
		}
		
		pos += data.write(int2bytes(hexTok.length, 2), pos, 'binary');
		pos += data.write(hexTok, pos, 'binary');
		pos += data.write(int2bytes(messageLength, 2), pos, 'binary');
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
			while(currentCache.length) {
				note = currentCache.shift();
				if(note['_uid'] == identifier) {
					break;
				}
			}
			// Notify callback of failed notification
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
	this.token = token;
	
	this.hexToken = function() { 
		token = self.token.replace(/\s/g, "");
		hexToken = "";
		for(var i=0; i < token.length; i+=2) {
			word = token[i];
			if((i + 1) >= token.length || typeof(token[i+1]) === undefined) {
				word += '0';
			}
			else {
				word += token[i+1];
			}
			hexToken += String.fromCharCode(parseInt(word, 16));
		}
		return hexToken;
	};
}


function int2bytes(number, length) {
	var chars = [];
	for(var i=0; i<length; i++) {
		chars.unshift(number & 0xff);
		number = number >> 8;
	}
	return String.fromCharCode.apply(String, chars);
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
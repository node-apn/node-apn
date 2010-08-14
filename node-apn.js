var net = require('net');
var EventEmitter = require('events').EventEmitter;
var crypto = require('crypto');
var sys = require('sys');
var fs = require('fs');
var Buffer = require('buffer').Buffer;

var Connection = function (optionArgs) {
	this.socket = new net.Stream();
	this.credentials = crypto.createCredentials();

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
					};
	
	if (optionArgs) {
		var keys = Object.keys(options);
		for (var i = 0; i < keys.length; i++) {
			var k = keys[i];
			if (optionArgs[k] !== undefined) options[k] = optionArgs[k];
		}
	}
	
	self.socket.on('connect', function() { console.log("connect."); });
	self.socket.on('data', function(data) { handleTransmissionError(data); });
	self.socket.on('end', function () { console.log('closed'); self.socket.end(); });
	
	fs.readFile(options['cert'], function(err, data) {
		if(err) {
			throw err;
		}
		self.credentials.context.setCert(data.toString());
		hasCert = true;
		if(hasCert && hasKey) {
			startSocket();
		}
	});

	fs.readFile(options['key'], function(err, data) {
		if(err) {
			throw err;
		}
		self.credentials.context.setKey(data.toString());
		hasKey = true;
		if(hasCert && hasKey) {
			startSocket();
		}
	});
	
	var startSocket = function () {
		self.socket.connect(options['port'], options['gateway']);
		self.socket.setSecure(self.credentials);
	}
	
	this.sendNotification = function (note) {
		var hexTok = note.device.hexToken();
		var message = JSON.stringify(note.payload);
		var pos = 0;
		
		if(options.enhanced) {
			var data = new Buffer(1 + 4 + 4 + 2 + hexTok.length + 2 + message.length);
			// Command
			data[pos] = 1;
			pos++;
			
			// Identifier
			pos += data.write(int32val(note.identifier), pos, 'binary');
			
			// Expiry
			pos += data.write(int32val(note.expiry), pos, 'binary');
		}
		else {
			var data = new Buffer(1 + 2 + hexTok.length + 2 + message.length);
			data[pos] = 0;
			pos++;
		}
		
		pos += data.write(int16val(hexTok.length), pos, 'binary');
		pos += data.write(hexTok, pos, 'binary');
		pos += data.write(int16val(message.length), pos, 'binary');
		pos += data.write(message, pos);
		
		// Generate our own identifiers?
		// Need to check notification length at some point
		// Push to array
		// If array exceeds a certain length then pop and item off
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
	
	var handleTransmissionEror = function() {
		
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

function int16val(number) {
	return String.fromCharCode(((number >> 8) & 0xff), (number & 0xff));
}

function int32val(number) {
	return String.fromCharCode((number >> 24), ((number >> 16) & 0xff), ((number >> 8) & 0xff), (number & 0xfF));
}
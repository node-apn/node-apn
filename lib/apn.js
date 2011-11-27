var tls = require('tls');
var fs = require('fs');
var Buffer = require('buffer').Buffer;

var Errors = {
	  'noErrorsEncountered': 0
	, 'processingError': 1
	, 'missingDeviceToken': 2
	, 'missingTopic': 3
	, 'missingPayload': 4
	, 'invalidTokenSize': 5
	, 'invalidTopicSize': 6
	, 'invalidPayloadSize': 7
	, 'invalidToken': 8
	, 'none': 255
}

var Connection = function (optionArgs) {
	var currentId = 0;
	var cachedNotes = [];

	var self = this;
	var hasKey = hasCert = false;
	var socketOptions = {};
	var openingSocket = false;
	var writeBuffer = [];
	
	var options =	{ cert: 'cert.pem' /* Certificate file */
					, key:	'key.pem'  /* Key file */
					, gateway: 'gateway.push.apple.com' /* gateway address */
					, port: 2195 /* gateway port */
					, enhanced: true /* enable enhanced format */
					, errorCallback: undefined /* Callback when error occurs */
					, cacheLength: 5 /* Number of notifications to cache for error purposes */
					};
	
	if (optionArgs) {
		var keys = Object.keys(options);
		for (var i = 0; i < keys.length; i++) {
			var k = keys[i];
			if (optionArgs[k] !== undefined) options[k] = optionArgs[k];
		}
	}
	
	var readyToConnect = function () {
		return (hasKey && hasCert);
	}

	var onDrain = function() {
		while (writeBuffer.length && self.socket.socket.bufferSize == 0) {
			writeNotificationToSocket(writeBuffer.shift());
		}
	};

    var startSocket = function () {
    	if(!self.openingSocket) {
			process.nextTick(function() {
				self.socket = tls.connect(options['port'], options['gateway'], socketOptions, 
					callback = function() {
						if(!self.socket.authorized) { 
							throw self.socket.authorizationError 
						}
		
						onDrain();
						self.openingSocket=false;
					});
		
				self.socket.on('data', function(data) {
					handleTransmissionError(data);
				});
		
				self.socket.on('error', function(data) {
					self.socket.removeAllListeners();
					self.socket = undefined;
				});
		
				self.socket.once('close', function () {
					if(writeBuffer.length && readyToConnect()) {
						startSocket();
					}
					if (!self.socket) {
						return;
					}
					
					self.socket.removeAllListeners();
					self.socket = undefined;
				});
		
				self.socket.on("drain", onDrain);
			});
			self.openingSocket = true;
		}
	}
	
	var connect = invoke_after(function() { startSocket(); });
	
	fs.readFile(options['cert'], connect(function(err, data) {
		if(err) {
			throw err;
		}
		socketOptions['cert'] = data.toString();
		hasCert = true;
	}));

	fs.readFile(options['key'], connect(function(err, data) {
		if(err) {
			throw err;
		}
		socketOptions['key'] = data.toString();
		hasKey = true;
	}));

	var writeNotificationToSocket = function(data) {
		if (self.socket === undefined  || self.socket.readyState != 'open') {
			if ((self.socket === undefined || self.socket.readyState == 'closed') && readyToConnect()) {
				startSocket();
			}
			bufferDataForWrite(data);
		} else {
			if (self.socket.socket.bufferSize > 0) {
				bufferDataForWrite(data);
			} else {
				self.socket.write(data);
			}
		}
	};

	var bufferDataForWrite = function(data) {
		writeBuffer.push(data);
	}

	this.sendNotification = function (note) {
		var encoding = 'utf8';
		if(note.encoding) {
			encoding = note.encoding;
		}
		var token = note.device.token;
		var message = JSON.stringify(note);
		var messageLength = Buffer.byteLength(message, encoding);
		var pos = 0;
		
		if(token === undefined) {
			return Errors['missingDeviceToken'];
		}
		if(messageLength > 256) {
			return Errors['invalidPayloadSize'];
		}
		
		note._uid = currentId++;
		if(options.enhanced) {
			var data = new Buffer(1 + 4 + 4 + 2 + token.length + 2 + messageLength);
			// Command
			data[pos] = 1;
			pos++;
			
			// Identifier
			pos += int2buf(note._uid, data, pos, 4);
			
			// Expiry
			pos += int2buf(note.expiry, data, pos, 4);
			
			cachedNotes.push(note);
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
		pos += data.write(message, pos, encoding);

		writeNotificationToSocket(data);
	}
	
	var tidyCachedNotes = function() {
		// Maybe a timestamp should be stored for each note and kept for a duration?
		if(cachedNotes.length > options.cacheLength) {
			cachedNotes.shift();
		}
	}
		
	var handleTransmissionError = function(data) {
		// Need to check message that errors
		// return failed notification to owner
		// purge writeBuffer and start again with cachedNotes
		//  perhaps we should keep an identifier with each writeBuffer
		//  entry to know where to stop when cycling through cachedNotes
		if (data[0] == 8) {
			self.socket.end();

			if (!options.enhanced) {
				cachedNotes = [];
				return;
			}

			// This is an error condition
			var errorCode = data[1];
			var identifier = bytes2int(data.slice(2,6), 4);
			var note = undefined;

			while(cachedNotes.length) {
				note = cachedNotes.shift();
				if(note['_uid'] == identifier) {
					break;
				}
			}

			// Notify callback of failed notification
			if(typeof options.errorCallback == 'function') {
				options.errorCallback(errorCode, note);
			}
			writeBuffer = [];
			var count = cachedNotes.length;
			for(var i=0; i<count; i++) {
				note = cachedNotes.shift();
				self.sendNotification(note);
			}
		}
	}
}

var Notification = function () {
	this.payload = {};
	this.expiry = 0;
	this.identifier = 0;
	this.device;
	
	this.alert = undefined;
	this.badge = undefined;
	this.sound = undefined;
}

Notification.prototype.toJSON = function() {
	if(this.payload.aps === undefined) {
		this.payload.aps = {};
	}
	if(typeof this.badge == 'number') {
		this.payload.aps.badge = this.badge;
	}
	if(typeof this.sound == 'string') {
		this.payload.aps.sound = this.sound;
	}
	if(typeof this.alert == 'string' || typeof this.alert == 'object') {
		this.payload.aps.alert = this.alert;
	}
	return this.payload;
}

var Device = function (/* deviceToken, ascii=true */) {
	var self = this;
	self.token = undefined;
			
	if(arguments.length > 0) {
		self.setToken.apply(self, arguments);
	}
}

Device.prototype.parseToken = function (token) {
	token = token.replace(/\s/g, "");
	length = Math.ceil(token.length / 2);
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

Device.prototype.setToken = function (newToken, ascii) {
	if(ascii === undefined || ascii == true) {
		newToken = this.parseToken(newToken);
	}
	this.token = newToken;
	return this;
}

Device.prototype.hexToken = function () {
	var out = [],
		len = this.token.length;
	for (var i = 0; i < len; i++) {
		n = this.token[i];
		if (n < 16) out[i] = "0" + n.toString(16);
		else out[i] = n.toString(16);
	}
	return out.join("");
}

var Feedback = function (optionArgs) {
	var self = this;
	var hasKey = hasCert = false;
	var socketOptions = {}
	
	var responsePacketLength = 38;	
	var readBuffer = new Buffer(responsePacketLength);
	var readLength = 0;
	
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
	
	if(typeof options['feedback'] != 'function') {
		return Error(-1, 'A callback function must be specified');
	}
	
	this.readyToConnect = function () {
		return (hasKey && hasCert);
	}
		
	self.startSocket = function () {
		self.socket = tls.connect(options['port'], options['address'], socketOptions);
		self.socket.pair.on('secure', function () { if(!self.socket.authorized) { throw self.socket.authorizationError } });
		self.socket.on('data', function(data) { processData(data); });
		self.socket.once('error', function(data) {self.socket.removeAllListeners(); self.socket = undefined; });
		self.socket.once('end', function () {  });
		self.socket.once('close', function () { self.socket.removeAllListeners(); self.socket = undefined; });
	}
	
	var connect = invoke_after(function() { self.startSocket(); });
	
	fs.readFile(options['cert'], connect(function(err, data) {
		if(err) {
			throw err;
		}
		socketOptions['cert'] = data.toString();
		hasCert = true;
	}));

	fs.readFile(options['key'], connect(function(err, data) {
		if(err) {
			throw err;
		}
		socketOptions['key'] = data.toString();
		hasKey = true;
	}));
	
	if(options['interval'] > 0) {
		this.interval = setInterval(function() { self.request(); }, options['interval'] * 1000);
	}
	
	var processData = function(data) {
		var pos = 0;
		// If there is some buffered data, read the remainder and process this first.
		if(readLength > 0) {
			if(data.length < (responsePacketLength - readLength)) {
				data.copy(readBuffer, readLength, 0);
				readLength += data.length;
				return;
			}
			data.copy(readBuffer, readLength, 0, responsePacketLength-readLength);
			decodeResponse(readBuffer, 0);
			pos = responsePacketLength-readLength;
			readLength = 0;
		}
		while(pos<data.length-1) {
			if((data.length-pos) < responsePacketLength) {
				//Buffer remaining data until next time
				data.copy(readBuffer, 0, pos);
				readLength = data.length - pos;
				break;
			}
			decodeResponse(data, pos);
			pos += responsePacketLength;
		}
	}
	
	var decodeResponse = function(data, start) {
		time = bytes2int(data, 4, start);
		start += 4;
		len  = bytes2int(data, 2, start);
		start += 2;
		tok  = new Buffer(len);
		data.copy(tok, 0, start, start+len);
		
		if(typeof options['feedback'] == 'function') {
			options['feedback'](time, new exports.device(tok, false));
		}
	}
}

Feedback.prototype.request = function () {
	if((this.socket === undefined || this.socket.readyState == 'closed') && this.readyToConnect()) {
		this.startSocket();
	}
}
	
Feedback.prototype.cancel = function () {
	if(this.interval !== undefined) {
		clearInterval(this.interval);
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

function bytes2int(bytes, length, start) {
	if(start === undefined) start = 0;
	var num = 0;
	length -= 1;
	for(var i=0; i<=length; i++) {
		num += (bytes[start+i] << ((length - i) * 8));
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

exports.connection = Connection;
exports.notification = Notification;
exports.device = Device;
exports.feedback = Feedback;
exports.error = Errors;
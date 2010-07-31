var net = require('net');
var crypto = require('crypto');
var sys = require('sys');
var fs = require('fs');
var Buffer = require('buffer').Buffer;

exports.create = function (optionArgs) {
	this.socket = new net.Stream();
	this.credentials = crypto.createCredentials();

	var self = this;
	var hasKey = hasCert = false;
	
	var options = 	{ cert: 'cert.pem'
					, key:	'key.pem'
					, gateway: 'gateway.push.apple.com'
					, port: 2195
					, enhanced: false
					};
	
	if (optionArgs) {
		var keys = Object.keys(options);
		for (var i = 0; i < keys.length; i++) {
			var k = keys[i];
			if (optionArgs[k] !== undefined) options[k] = optionArgs[k];
		}
	}
	
	self.socket.on('connect', function() { console.log("connect."); });
	self.socket.on('data', function(data) {  });
	self.socket.on('end', function () { console.log('closed'); self.socket.end() });
	
	fs.readFile(options['cert'], function(err, data) {
		if(err) {
			throw err;
		}
		self.credentials.context.setCert(data.toString());
		hasCert = true;
		if(hasCert && hasKey) {
			self.startSocket();
		}
	});

	fs.readFile(options['key'], function(err, data) {
		if(err) {
			throw err;
		}
		self.credentials.context.setKey(data.toString());
		hasKey = true;
		if(hasCert && hasKey) {
			self.startSocket();
		}
	});
	
	this.startSocket = function () {
		self.socket.connect(options['port'], options['gateway']);
		self.socket.setSecure(self.credentials);
	}
	
	this.sendMessage = function (device, note) {
		var hexTok = device.hexToken();
		var message = JSON.stringify(note);
		var data = new Buffer(hexTok.length + message.length + 5);
		var pos = 0;
		
		data[0] = 0;
		pos = data.write(binLength(hexTok), 1, 'binary') + 1;
		pos += data.write(hexTok, 3, 'binary');
		pos += data.write(binLength(message), pos, 'binary');
		data.write(message, pos);
		
		if(self.socket.readyState != 'open') {
			if(self.socket.readyState == 'closed' && hasKey && hasCert) {
				self.startSocket();
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
}

exports.notification = function () {
	this.payload = {aps: {}};
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

function binLength(string) {
	var length = string.length;
	var retVal = String.fromCharCode((length >> 8), (length & 0xff));
	return retVal;
}
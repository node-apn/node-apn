var Buffer = require('buffer').Buffer;

/**
 * Device - Initialise a Device object.
 * @constructor
 * @param {String|Buffer} token Device token
 * @param {Boolean} [ascii=true] Whether the supplied Device token is in ASCII Format.
 */
var Device = function (/* deviceToken, ascii=true */) {
	var self = this;
	self.token = undefined;

	if (arguments.length > 0) {
		self.setToken.apply(self, arguments);
	}
};

/**
 * parseToken - Parse an ASCII token into a Buffer
 * @param {String} token Device token
 * @returns {Buffer} Buffer containing the binary representation of the token.
 */
Device.prototype.parseToken = function (token) {
	token = token.replace(/\s/g, "");
	var length = Math.ceil(token.length / 2);
	var hexToken = new Buffer(length);
	for (var i = 0; i < token.length; i += 2) {
		var word = token[i];
		if ((i + 1) >= token.length || typeof(token[i + 1]) === undefined) {
			word += '0';
		}
		else {
			word += token[i + 1];
		}
		hexToken[i / 2] = parseInt(word, 16);
	}
	return hexToken;
};

Device.prototype.setToken = function (newToken, ascii) {
	if (ascii === undefined || ascii == true) {
		newToken = this.parseToken(newToken);
	}
	this.token = newToken;
	return this;
};
	
Device.prototype.hexToken = function () {
	var out = [];
	var len = this.token.length;
	var n;
	for (var i = 0; i < len; i++) {
		n = this.token[i];
		if (n < 16) out[i] = "0" + n.toString(16);
		else out[i] = n.toString(16);
	}
	return out.join("");
};

module.exports = Device;
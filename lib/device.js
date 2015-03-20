"use strict";
/**
 * Creates a Device.
 * @constructor
 * @param {String|Buffer} token Device token
 */
function Device(deviceToken) {
	if (!(this instanceof Device)) {
		return new Device(deviceToken);
	}

	if(typeof deviceToken === "string") {
		this.token = new Buffer(deviceToken.replace(/[^0-9a-f]/gi, ""), "hex");
	}
	else if(Buffer.isBuffer(deviceToken)) {
		this.token = new Buffer(deviceToken.length);
		deviceToken.copy(this.token);
	}
	
	if (!this.token || this.token.length === 0) {
		throw new Error("Invalid Token Specified, must be a Buffer or valid hex String");
	}
}

/**
 * @returns {String} Device token in hex string representation
 * @since v1.2.0
 */
Device.prototype.toString = function() {
	return this.token.toString("hex");
};

module.exports = Device;
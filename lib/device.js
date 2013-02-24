/**
 * Creates a Device.
 * @constructor
 * @deprecated since v1.3.0 pass raw buffers or strings to `pushNotification`
 * @param {String|Buffer} token Device token
 */
function Device(deviceToken) {
	if(typeof deviceToken == "string") {
		this.token = new Buffer(deviceToken.replace(/\s/g, ""), "hex");
	}
	else {
		this.token = deviceToken;
	}
};

/**
 * @returns {String} Device token in hex string representation
 * @since v1.2.0
 */
Device.prototype.toString = function() {
	return this.token.toString("hex");
}

module.exports = Device;
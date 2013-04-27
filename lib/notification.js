/**
 * Create a notification
 * @constructor
 */
function Notification (payload) {
	this.encoding = 'utf8';

	this.payload = payload || {};
	this.expiry = 0;
	this.identifier = 0;

	/** @deprecated since v1.3.0 used connection#pushNotification instead which accepts device token separately **/
	this.device = undefined;

	this.alert = undefined;
	this.badge = undefined;
	this.sound = undefined;
	/** @since v1.2.0 */
	this.newsstandAvailable = undefined;

	this.mdm = undefined;

	this.compiled = false;
}

/**
 * Clone a notification to send to multiple devices
 * @param {Device} [device] Device the notification will be sent to
 * @returns {Notification} A notification containing the same properties as the receiver
 * @since v1.2.0
 * @deprecated Since v1.3.0, notifications are not tied to a device so do not need cloning.
 */
Notification.prototype.clone = function (device) {
	var notification = new Notification();

	notification.encoding = this.encoding;
	notification.payload = this.payload;
	notification.expiry = this.expiry;
	notification.identifier = this.identifier;
	notification.device = device;

	notification.alert = this.alert;
	notification.badge = this.badge;
	notification.sound = this.sound;
	notification.newsstandAvailable = this.newsstandAvailable;
	notification.mdm = this.mdm;

	return notification;
};

/**
 * Set the alert text for the notification
 * @param {String} alertText The text of the alert message.
 * @see The <a href="https://developer.apple.com/library/ios/#documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/ApplePushService/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW1">Payload Documentation</a>
 * @since v1.2.0
 */
Notification.prototype.setAlertText = function (text) {
	if(typeof this.alert != "object") {
		this.alert = text;
	}
	else {
		this.prepareAlert();
		this.alert['body'] = text;
	}
};

/**
 * Set the action-loc-key property on the alert object
 * @param {String} [key] If a string is specified, displays an alert with two buttons, whose behavior is described in Table 3-1. However, iOS uses the string as a key to get a localized string in the current localization to use for the right button’s title instead of “View”. If the value is null, the system displays an alert with a single OK button that simply dismisses the alert when tapped.
 * @see The <a href="https://developer.apple.com/library/ios/#documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/ApplePushService/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW1">Payload Documentation</a>
 * @since v1.2.0
 */
Notification.prototype.setActionLocKey = function (key) {
	this.prepareAlert();
	this.alert['action-loc-key'] = key;
};

/**
 * Set the loc-key parameter on the alert object
 * @param {String} [key] A key to an alert-message string in a Localizable.strings file for the current localization (which is set by the user’s language preference).
 * @see The <a href="https://developer.apple.com/library/ios/#documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/ApplePushService/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW1">Payload Documentation</a>
 * @since v1.2.0
 */
Notification.prototype.setLocKey = function (key) {
	this.prepareAlert();
	if(!key) {
		delete this.alert["loc-key"];
		return;
	}
	this.alert['loc-key'] = key;
};

/**
 * Set the loc-args parameter on the alert object
 * @param {String[]} [args] Variable string values to appear in place of the format specifiers in loc-key.
 * @see The <a href="https://developer.apple.com/library/ios/#documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/ApplePushService/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW1">Payload Documentation</a>
 * @since v1.2.0
 */
Notification.prototype.setLocArgs = function (args) {
	this.prepareAlert();
	if(!args) {
		delete this.alert["loc-args"];
		return;
	}
	this.alert['loc-args'] = args;
};

/**
 * Set the launch-image parameter on the alert object
 * @param {String} [image] The filename of an image file in the application bundle; it may include the extension or omit it.
 * @see The <a href="https://developer.apple.com/library/ios/#documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/ApplePushService/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW1">Payload Documentation</a>
 * @since v1.2.0
 */
Notification.prototype.setLaunchImage = function (image) {
	this.prepareAlert();
	if(!image) {
		delete this.alert["launch-image"];
		return;
	}
	this.alert["launch-image"] = image;
};


/**
 * If an alert object doesn't already exist create it and transfer any existing message into the .body property
 * @private
 * @since v1.2.0
 */
Notification.prototype.prepareAlert = function () {
	var existingValue = this.alert;
	if(typeof existingValue != "object") {
		this.alert = {};
		if(typeof existingValue == "string") {
			this.alert.body = existingValue;
		}
	}
};

/**
 * @returns {Number} Byte length of the notification payload
 * @since v1.2.0
 */
Notification.prototype.length = function () {
	return Buffer.byteLength(JSON.stringify(this), this.encoding || 'utf8');
};

/**
 * If the notification payload is too long to send this method will attempt to trim the alert body text.
 * @returns {Number} The number of characters removed from the body text. If a negative value is returned, the text is too short to be trimmed enough.
 * @since v1.2.0
 */
Notification.prototype.trim = function() {
	var tooLong = this.length() - 256;
	if(tooLong <= 0) {
		return 0;
	}
	var length;
	var encoding = this.encoding || 'utf8';
	if(typeof this.alert == "string") {
		length = Buffer.byteLength(this.alert, encoding);
		if (length < tooLong) {
			return length - tooLong;
		}
		this.alert = this.truncateStringToLength(this.alert, length - tooLong);
		return tooLong;
	}
	else if(typeof this.alert == "object" && typeof this.alert.body == "string") {
		length = Buffer.byteLength(this.alert.body, encoding);
		if (length < tooLong) {
			return length - tooLong;
		}
		this.alert.body = this.truncateStringToLength(this.alert.body, length - tooLong);
		return tooLong;
	}
	return -tooLong;
};

/**
 * Compile a notification down to its JSON format. Compilation is final, changes made to the notification after this method is called will not be reflected in further calls.
 * @returns {String} JSON payload for the notification.
 * @since v1.3.0
 */
Notification.prototype.compile = function () {
	if(this.compiled) {
		return this.compiledPayload;
	}
	this.compiledPayload = JSON.stringify(this);
	this.compiled = true;
	return this.compiledPayload;
};

/**
 * @param {String} [string] Unicode string to be truncated
 * @param {Number} [length] The maximum number of bytes permitted in the Unicode string
 * @returns {String} Truncated String
 * @private
 */
Notification.prototype.truncateStringToLength = function (string, length) {
	var result = new Buffer(string, this.encoding || 'utf8').toString(this.encoding || 'utf8', 0, length);

	// since we might have chopped off the end of a multi-byte sequence, remove any
	// invalid characters (represented as U+FFFD "REPLACEMENT CHARACTER") for UTF-8
	// or orphaned lead surrogates for UTF-16 (UCS-2) - where only the tail surrogate 
	// has been removed.
	var done = false;
	var encoding = this.encoding || 'utf8';

	if (encoding != 'utf8' && encoding != 'utf16le' && encoding != 'ucs2') {
		return result;
	}
	while (! done) {
		var lastIndex = result.length - 1;
		var code = result.charCodeAt(lastIndex);
		if (code != 0xFFFD && encoding == 'utf8') {
			done = true;
		}
		else if ((code < 0xD800 || code > 0xDBFF) && (encoding == 'utf16le' || encoding == 'ucs2')) {
			done = true;
		}
		else {
			result = result.substr(0, lastIndex);
		}
	}

	return result;
};

/**
 * @private
 */
Notification.prototype.toJSON = function () {
	if (this.payload === undefined) {
		this.payload = {};
	}
	if (typeof this.mdm == 'string') {
		this.payload.mdm = this.mdm;
		return this.payload;
	}
	if (this.payload.aps === undefined) {
		this.payload.aps = {};
	}
	if (typeof this.badge == 'number') {
		this.payload.aps.badge = this.badge;
	}
	if (typeof this.sound == 'string') {
		this.payload.aps.sound = this.sound;
	}
	if (typeof this.alert == 'string' || typeof this.alert == 'object') {
		this.payload.aps.alert = this.alert;
	}
	if (this.newsstandAvailable) {
		this.payload.aps['content-available'] = 1;
	}
	return this.payload;
};

module.exports = Notification;

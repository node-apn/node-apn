"use strict";
/**
 * Create a notification
 * @constructor
 */
function Notification (payload) {
	this.encoding = "utf8";

	this.payload = payload || {};
	this.expiry = 0;
	this.priority = 10;

	this.retryLimit = -1;

	/** @deprecated since v1.3.0 used connection#pushNotification instead which accepts device token separately **/
	this.device = undefined;

	this.alert = undefined;
	this.badge = undefined;
	this.sound = undefined;
	/** @since v1.2.0 */
	this.newsstandAvailable = undefined;

	this.contentAvailable = undefined;

	this.mdm = undefined;

	this.compiled = false;

	this.truncateAtWordEnd = false;

	this.urlArgs = undefined;

	/** iOS 8 notification actions **/
	this.category = undefined;
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
	notification.priority = this.priority;
	notification.device = device;

	notification.alert = this.alert;
	notification.badge = this.badge;
	notification.sound = this.sound;
	notification.newsstandAvailable = this.newsstandAvailable;
	notification.contentAvailable = this.contentAvailable;
	notification.mdm = this.mdm;
	notification.truncateAtWordEnd = this.truncateAtWordEnd;
	notification.urlArgs = this.urlArgs;

	notification.category = this.category;

	return notification;
};

/**
 * Set the expiry value on the payload
 * @param {Number} [expiry] Timestamp when the notification should expire.
 * @since v1.3.5
 */
Notification.prototype.setExpiry = function (expiry) {
	this.expiry = expiry;
	return this;
};

/**
 * Set the priority
 * @param {Number} [priority=10] Priority value for the notification.
 * @since v1.3.9
 */
 Notification.prototype.setPriority = function (priority) {
 	this.priority = priority;
 	return this;
 };

/**
 * Set the "badge" value on the alert object
 * @param {Number} [badge] Badge Value
 * @since v1.3.5
 */
Notification.prototype.setBadge = function (badge) {
	this.badge = badge;
	return this;
};

/**
 * Set the "sound" value on the alert object
 * @param {String} [sound] Sound file name
 * @since v1.3.5
 */
Notification.prototype.setSound = function (sound) {
	this.sound = sound;
	return this;
};

Notification.prototype.getAlertText = function () {
	if(typeof this.alert === "object") {
		return this.alert.body;
	}
	return this.alert;
};

/**
 * Set the alert text for the notification
 * @param {String} alertText The text of the alert message.
 * @see The <a href="https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW1">Payload Documentation</a>
 * @since v1.2.0
 */
Notification.prototype.setAlertText = function (text) {
	if(typeof this.alert !== "object") {
		this.alert = text;
	}
	else {
		this.prepareAlert();
		this.alert.body = text;
	}
	return this;
};

/**
 * Set the alert title for the notification - used with Safari Push Notifications
 * @param {String} alertTitle The title for the alert.
 * @see The <a href="https://developer.apple.com/library/mac/documentation/NetworkingInternet/Conceptual/NotificationProgrammingGuideForWebsites/PushNotifications/PushNotifications.html#//apple_ref/doc/uid/TP40013225-CH3-SW12">Pushing Notifications</a> in the Notification Programming Guide for Websites
 * @since v1.5.0
 */
Notification.prototype.setAlertTitle = function(alertTitle) {
	this.prepareAlert();
	this.alert.title = alertTitle;
	return this;
};

/**
 * Set the alert action label for the notification - used with Safari Push Notifications
 * @param {String} alertLabel The label for the alert action button.
 * @see The <a href="https://developer.apple.com/library/mac/documentation/NetworkingInternet/Conceptual/NotificationProgrammingGuideForWebsites/PushNotifications/PushNotifications.html#//apple_ref/doc/uid/TP40013225-CH3-SW12">Pushing Notifications</a> in the Notification Programming Guide for Websites
 * @since v1.5.0
 */
Notification.prototype.setAlertAction = function(alertAction) {
	this.prepareAlert();
	this.alert.action = alertAction;
	return this;
};

/**
 * Set the action-loc-key property on the alert object
 * @param {String} [key] If a string is specified, displays an alert with two buttons, whose behavior is described in Table 3-1. However, iOS uses the string as a key to get a localized string in the current localization to use for the right button’s title instead of “View”. If the value is null, the system displays an alert with a single OK button that simply dismisses the alert when tapped.
 * @see The <a href="https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW1">Payload Documentation</a>
 * @since v1.2.0
 */
Notification.prototype.setActionLocKey = function (key) {
	this.prepareAlert();
	this.alert["action-loc-key"] = key;
	return this;
};

/**
 * Set the loc-key parameter on the alert object
 * @param {String} [key] A key to an alert-message string in a Localizable.strings file for the current localization (which is set by the user’s language preference).
 * @see The <a href="https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW1">Payload Documentation</a>
 * @since v1.2.0
 */
Notification.prototype.setLocKey = function (key) {
	this.prepareAlert();
	if(!key) {
		delete this.alert["loc-key"];
		return;
	}
	this.alert["loc-key"] = key;
	return this;
};

/**
 * Set the loc-args parameter on the alert object
 * @param {String[]} [args] Variable string values to appear in place of the format specifiers in loc-key.
 * @see The <a href="https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW1">Payload Documentation</a>
 * @since v1.2.0
 */
Notification.prototype.setLocArgs = function (args) {
	this.prepareAlert();
	if(!args) {
		delete this.alert["loc-args"];
		return;
	}
	this.alert["loc-args"] = args;
	return this;
};

/**
 * Set the launch-image parameter on the alert object
 * @param {String} [image] The filename of an image file in the application bundle; it may include the extension or omit it.
 * @see The <a href="https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW1">Payload Documentation</a>
 * @since v1.2.0
 */
Notification.prototype.setLaunchImage = function (image) {
	this.prepareAlert();
	if(!image) {
		delete this.alert["launch-image"];
		return;
	}
	this.alert["launch-image"] = image;
	return this;
};

/**
 * Set the 'content-available' flag on the payload
 * @param {Boolean} [contentAvailable] Whether the content-available flag should be set or not.
 * @since v1.3.5
 */
Notification.prototype.setContentAvailable = function (contentAvailable) {
	this.contentAvailable = contentAvailable;
	return this;
};

/**
 * Set the 'content-available' flag on the payload
 * @param {Boolean} [newsstandAvailable] Whether the content-available flag should be set or not.
 * @since v1.3.5
 */
Notification.prototype.setNewsstandAvailable = function (newsstandAvailable) {
	this.newsstandAvailable = newsstandAvailable;
	return this;
};

/**
 * Set the 'mdm' flag on the payload
 * @param {Object} [mdm] The mdm property for the payload.
 * @since v1.3.5
 */
Notification.prototype.setMDM = function (mdm) {
	this.mdm = mdm;
	return this;
};

/**
 * Set the 'truncateAtWordEnd' flag for truncation logic
 * @param {Boolean} [truncateAtWordEnd] Whether the truncateAtWordEnd flag should be set or not.
 */
Notification.prototype.setTruncateAtWordEnd = function (truncateAtWordEnd) {
	this.truncateAtWordEnd = truncateAtWordEnd;
	return this;
};

/**
 * Set the urlArgs for the notification
 * @param {Array} [urlArgs] The url args for the endpoint
 * @see The <a href="https://developer.apple.com/library/prerelease/mac/documentation/NetworkingInternet/Conceptual/NotificationProgrammingGuideForWebsites/PushNotifications/PushNotifications.html#//apple_ref/doc/uid/TP40013225-CH3-SW12">Web Payload Documentation</a>
 * @since v1.4.1
 */
Notification.prototype.setUrlArgs = function (urlArgs) {
	this.urlArgs = urlArgs;
	return this;
};

/**
 * Set the category for the notification
 * @param {String} [category] The category for the push notification action
 */
Notification.prototype.setCategory = function (category) {
	this.category = category;
	return this;
};

/**
 * If an alert object doesn't already exist create it and transfer any existing message into the .body property
 * @private
 * @since v1.2.0
 */
Notification.prototype.prepareAlert = function () {
	var existingValue = this.alert;
	if(typeof existingValue !== "object") {
		this.alert = {};
		if(typeof existingValue === "string") {
			this.alert.body = existingValue;
		}
	}
};

/**
 * @returns {Number} Byte length of the notification payload
 * @since v1.2.0
 */
Notification.prototype.length = function () {
	this.compiled = false;
	return Buffer.byteLength(this.compile(), this.encoding || "utf8");
};

/**
 * If the notification payload is too long to send this method will attempt to trim the alert body text.
 * @returns {Number} The number of characters removed from the body text. If a negative value is returned, the text is too short to be trimmed enough.
 * @since v1.2.0
 */
Notification.prototype.trim = function(length) {
	var tooLong = this.length() - (length || 2048);
	if(tooLong <= 0) {
		return 0;
	}
	this.compiled = false;
	var encoding = this.encoding || "utf8";
	var escaped; // Working variable for trimming string
	if(typeof this.alert === "string") {
		escaped = this.alert;
	}
	else if(typeof this.alert === "object" && typeof this.alert.body === "string") {
		escaped = this.alert.body;
	}
	else {
		return -tooLong;
	}
	
	escaped = JSON.stringify(escaped).slice(1, -1); // trim quotes
	length = Buffer.byteLength(escaped, encoding);
	if (length < tooLong) {
		return length - tooLong;
	}
	escaped = this.truncateStringToLength(escaped, length - tooLong, encoding);
	escaped = escaped.replace(/(\\|\\u[0-9a-fA-F]{0,3})$/, "");

	escaped = JSON.parse("\"" + escaped + "\"");

	this.setAlertText(escaped);
	return tooLong;
};

/**
 * Compile a notification down to its JSON format. Compilation is final, changes made to the notification after this method is called will not be reflected in further calls.
 * @returns {String} JSON payload for the notification.
 * @since v1.3.0
 */
Notification.prototype.compile = function () {
	if(!this.compiled) {
		this.compiled = JSON.stringify(this);
	}
	return this.compiled;
};

function hasValidUnicodeTail(string, encoding) {
	var code = string.charCodeAt(string.length - 1);
	if (code !== 0xFFFD && encoding === "utf8") {
		return true;
	}
	else if ((code < 0xD800 || code > 0xDBFF) && (encoding === "utf16le" || encoding === "ucs2")) {
		return true;
	}
	return false;
}

/**
 * @param {String} [string] Unicode string to be truncated
 * @param {Number} [length] The maximum number of bytes permitted in the Unicode string
 * @returns {String} Truncated String
 * @private
 */
Notification.prototype.truncateStringToLength = function (string, length, encoding) {
	// Convert to a buffer and back to a string with the correct encoding to truncate the unicode series correctly.
	var result = new Buffer(string, encoding).toString(encoding, 0, length);
	
	if (this.truncateAtWordEnd === true) {
		var lastSpaceIndexInResult = result.lastIndexOf(" ");

		// Only truncate the string further if the remainder isn't a whole word
		// which we can tell by checking the *next* character in the original string
		if(lastSpaceIndexInResult !== -1 && string.charAt(result.length + 1) !== " "){
			result = result.substr(0, lastSpaceIndexInResult);
		}
	}

	// since we might have chopped off the end of a multi-byte sequence, remove any
	// invalid characters (represented as U+FFFD "REPLACEMENT CHARACTER") for UTF-8
	// or orphaned lead surrogates for UTF-16 (UCS-2) - where only the tail surrogate
	// has been removed.
	if (encoding === "utf8" || encoding === "utf16le" || encoding === "ucs2") {
		while( result.length > 0 && !hasValidUnicodeTail(result, encoding) ) {
			result = result.substr(0, result.length - 1);
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
	if (typeof this.mdm === "string") {
		this.payload.mdm = this.mdm;
		return this.payload;
	}
	var apsSet = true;
	if (this.payload.aps === undefined) {
		this.payload.aps = {};
		apsSet = false;
	}
	if (typeof this.badge === "number") {
		this.payload.aps.badge = this.badge;
		apsSet = true;
	}
	if (typeof this.sound === "string") {
		this.payload.aps.sound = this.sound;
		apsSet = true;
	}
	if (typeof this.alert === "string" || typeof this.alert === "object") {
		this.payload.aps.alert = this.alert;
		apsSet = true;
	}
	if (this.newsstandAvailable || this.contentAvailable) {
		this.payload.aps["content-available"] = 1;
		apsSet = true;
	}
	if (Array.isArray(this.urlArgs)) {
		this.payload.aps["url-args"] = this.urlArgs;
		apsSet = true;
	}
	if (typeof this.category === "string") {
		this.payload.aps.category = this.category;
		apsSet = true;
	}

	if (!apsSet) {
		delete this.payload.aps;
	}

	return this.payload;
};

module.exports = Notification;

"use strict";
/**
 * Create a notification
 * @constructor
 */
function Notification (payload) {
	this.encoding = "utf8";

	if (payload) {
		this.payload = payload;
		this.compiled = JSON.stringify(payload);
	} else {
		this.payload = {};
		this.compiled = false;
	}

	this.aps = {};
	this.expiry = 0;
	this.priority = 10;

	this.truncateAtWordEnd = false;
}

Notification.prototype = require("./apsProperties");

["payload", "expiry", "priority", "alert", "body", "locKey",
"locArgs", "title", "titleLocKey", "titleLocArgs", "action",
"actionLocKey", "launchImage", "badge", "sound",
"contentAvailable", "mdm", "urlArgs", "category"].forEach( propName => {
	const methodName = "set" + propName[0].toUpperCase() + propName.slice(1);
	Notification.prototype[methodName] = function (value) {
		this[propName] = value;
		return this;
	}
});

Notification.prototype.headers = function headers() {
	let headers = {};

	if (this.priority !== 10) {
		headers["apns-priority"] = this.priority;
	}

	if (this.id) {
		headers["apns-id"] = this.id;
	}

	if (this.expiry > 0) {
		headers["apns-expiration"] = this.expiry;
	}

	if (this.topic) {
		headers["apns-topic"] = this.topic;
	}

	return headers;
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

/**
 * @returns {Number} Byte length of the notification payload
 * @since v1.2.0
 */
Notification.prototype.length = function () {
	return Buffer.byteLength(this.compile(), this.encoding || "utf8");
};

/**
 * If the notification payload is too long to send this method will attempt to trim the alert body text.
 * @returns {Number} The number of characters removed from the body text. If a negative value is returned, the text is too short to be trimmed enough.
 * @since v1.2.0
 */
Notification.prototype.trim = require("./trim");

/**
 * @private
 */
Notification.prototype.apsPayload = function() {
	var aps = this.aps;

	return Object.keys(aps).find( key => aps[key] !== undefined ) ? aps : undefined;
};

Notification.prototype.toJSON = function () {
	if (typeof this._mdm === "string") {
		return { "mdm": this._mdm };
	}
	
	this.payload.aps = this.apsPayload();

	return this.payload;
};

module.exports = Notification;

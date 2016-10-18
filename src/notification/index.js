"use strict";
/**
 * Create a notification
 * @constructor
 */
function Notification (payload) {
	this.encoding = "utf8";
	this.payload = {};
	this.compiled = false;

	this.aps = {};
	this.expiry = 0;
	this.priority = 10;

	if (payload) {
		for(let key in payload) {
			if (payload.hasOwnProperty(key)) {
				this[key] = payload[key];
			}
		}
	}
}

Notification.prototype = require("./apsProperties");

["payload", "expiry", "priority", "alert", "body", "locKey",
"locArgs", "title", "subtitle", "titleLocKey", "titleLocArgs", "action",
"actionLocKey", "launchImage", "badge", "sound", "contentAvailable",
"mutableContent", "mdm", "urlArgs", "category"].forEach( propName => {
	const methodName = "set" + propName[0].toUpperCase() + propName.slice(1);
	Notification.prototype[methodName] = function (value) {
		this[propName] = value;
		return this;
	};
});

Notification.prototype.headers = function headers() {
	let mHeaders = {};

	if (this.priority !== 10) {
		mHeaders["apns-priority"] = this.priority;
	}

	if (this.id) {
		mHeaders["apns-id"] = this.id;
	}

	if (this.expiry > 0) {
		mHeaders["apns-expiration"] = this.expiry;
	}

	if (this.topic) {
		mHeaders["apns-topic"] = this.topic;
	}

	if (this.collapseId) {
	    mHeaders["apns-collapse-id"] = this.collapseId;
	}

	if (this.threadId) {
		mHeaders["thread-id"] = this.threadId;
	}

	return mHeaders;
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
 * @private
 */
Notification.prototype.apsPayload = function() {
	var aps = this.aps;

	return Object.keys(aps).find( key => aps[key] !== undefined ) ? aps : undefined;
};

Notification.prototype.toJSON = function () {
	if (this.rawPayload != null) {
		return this.rawPayload;
	}
	
	if (typeof this._mdm === "string") {
		return { "mdm": this._mdm };
	}

	this.payload.aps = this.apsPayload();

	return this.payload;
};

module.exports = Notification;

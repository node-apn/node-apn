"use strict";

var Errors = require("./errors");

var q    = require("q");
var sysu = require("util");
var util = require("./util");
var events = require("events");
var Device = require("./device");
var loadCredentials = require("./credentials/load");
var parseCredentials = require("./credentials/parse");
var validateCredentials = require("./credentials/validate");

var debug = require("debug")("apn");
var trace = require("debug")("apn:trace");

/**
 * Create a new connection to the APN service.
 * @constructor
 * @param {Object} [options]
 * @config {Buffer|String} [cert="cert.pem"] The filename of the connection certificate to load from disk, or a Buffer/String containing the certificate data.
 * @config {Buffer|String} [key="key.pem"] The filename of the connection key to load from disk, or a Buffer/String containing the key data.
 * @config {Buffer[]|String[]} [ca] An array of trusted certificates. Each element should contain either a filename to load, or a Buffer/String to be used directly. If this is omitted several well known "root" CAs will be used. - You may need to use this as some environments don't include the CA used by Apple (entrust_2048).
 * @config {Buffer|String} [pfx] File path for private key, certificate and CA certs in PFX or PKCS12 format, or a Buffer/String containing the PFX data. If supplied will be used instead of certificate and key above.
 * @config {String} [passphrase] The passphrase for the connection key, if required
 * @config {Boolean} [production=(NODE_ENV=='production')] Specifies which environment to connect to: Production (if true) or Sandbox. (Defaults to false, unless NODE_ENV == "production")
 * @config {Boolean} [rejectUnauthorized=true] Reject Unauthorized property to be passed through to tls.connect()
 * @config {Number} [cacheLength=1000] Number of notifications to cache for error purposes (See doc/apn.markdown)
 * @config {Boolean} [autoAdjustCache=true] Whether the cache should grow in response to messages being lost after errors. (Will still emit a 'cacheTooSmall' event)
 * @config {Number} [maxConnections=1] The maximum number of connections to create for sending messages.
 * @config {Number} [connectionTimeout=3600000] The duration the socket should stay alive with no activity in milliseconds. 0 = Disabled.
 * @config {Boolean} [buffersNotifications=true] Whether to buffer notifications and resend them after failure.
 */
function Connection (options) {
	if(false === (this instanceof Connection)) {
        return new Connection(options);
    }
	this.options = {
		cert: "cert.pem",
		key: "key.pem",
		ca: null,
		pfx: null,
		passphrase: null,
		production: (process.env.NODE_ENV === "production"),
		voip: false,
		address: null,
		rejectUnauthorized: true,
		cacheLength: 1000,
		autoAdjustCache: true,
		maxConnections: 1,
		connectTimeout: 10000,
		connectionTimeout: 3600000,
		connectionRetryLimit: 10,
		buffersNotifications: true,
	};

	for (var key in options) {
		if (options[key] === null || options[key] === undefined) {
			debug("Option [" + key + "] set to null. This may cause unexpected behaviour.");
		}
	}

	util.extend(this.options, options);

	this.configureAddress();

	if (this.options.pfx || this.options.pfxData) {
		this.options.cert = options.cert;
		this.options.key = options.key;
	}

	events.EventEmitter.call(this);
}

sysu.inherits(Connection, events.EventEmitter);

Connection.prototype.configureAddress = function() {
	if (this.options.gateway) {
		this.options.address = this.options.gateway;
	}

	if (!this.options.address) {
		if (this.options.production) {
			this.options.address = "gateway.push.apple.com";
		}
		else {
			this.options.address = "gateway.sandbox.push.apple.com";
		}
	}
	else {
		if (this.options.address === "gateway.push.apple.com") {
			this.options.production = true;
		}
		else {
			this.options.production = false;
		}
	}
};

/**
 * You should never need to call this method, initialization and connection is handled by {@link Connection#sendNotification}
 * @private
 */
Connection.prototype.loadCredentials = function () {
	if (!this.credentialsPromise) {
		debug("Loading Credentials");

		var production = this.options.production;
		this.credentialsPromise = loadCredentials(this.options)
			.then(function(credentials) {
				var parsed;
				try {
					parsed = parseCredentials(credentials);
				}
				catch (e) {
					debug(e);
					return credentials;
				}
				parsed.production = production;
				validateCredentials(parsed);
				return credentials;
			});
	}

	return this.credentialsPromise;
};

Connection.prototype.validNotification = function (notification, recipient) {
	var messageLength = notification.length();
	var maxLength = (this.options.voip ? 4096 : 2048);

	if (messageLength > maxLength) {
		return false;
	}
	return true;
};

/**
 * Queue a notification for delivery to recipients
 * @param {Notification} notification The Notification object to be sent
 * @param {Device|String|Buffer|Device[]|String[]|Buffer[]} recipient The token(s) for devices the notification should be delivered to.
 * @since v1.3.0
 */
Connection.prototype.pushNotification = function (notification, recipient) {
};

module.exports = Connection;

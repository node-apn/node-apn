"use strict";

const Debug = require("debug");
const Promise = require("bluebird");
const EventEmitter = require("events");
const extend = require("./util/extend");

// TODO: Abstract into a `logger` object
let debug = Debug("apn");
let trace = Debug("apn:trace");

let EndpointAddress = {
	production: "api.push.apple.com",
	sandbox:    "api.sandbox.push.apple.com"
}

module.exports = function(dependencies) {
	const credentials = dependencies.credentials;
	const EndpointManager = dependencies.EndpointManager;

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
			address: null,
			rejectUnauthorized: true,
			connectTimeout: 10000,
			connectionTimeout: 3600000,
			connectionRetryLimit: 10,
		};

		validateOptions(options);

		extend(this.options, options);
		configureAddress(this.options);
		
		if (this.options.pfx || this.options.pfxData) {
			this.options.cert = options.cert;
			this.options.key = options.key;
		}

		new EndpointManager();

		EventEmitter.call(this);
	}

	Connection.prototype = Object.create(EventEmitter.prototype);

	/**
	 * Queue a notification for delivery to recipients
	 * @param {Notification} notification The Notification object to be sent
	 * @param {Device|String|Buffer|Device[]|String[]|Buffer[]} recipient The token(s) for devices the notification should be delivered to.
	 * @since v1.3.0
	 */
	Connection.prototype.pushNotification = function (notification, recipients) {
	  let body = notification.compile();
	  // this.loadCredentials().then( (credentials) => {
	  //   var endpoint = new Endpoint({
	  //     "address": this.options.address,
	  //     "port": 443,
	  //     "cert": credentials.cert,
	  //     "key": credentials.key
	  //   });

	  //   endpoint.on("connected", () => {
	  //     console.log("streaming")
	  //     let stream = endpoint.createStream();
	  //     let headers = {
	  //       ":scheme": "https",
	  //       ":method": "POST",
	  //       ":authority": this.options.address,
	  //       ":path": "/3/device/" + recipients[0],

	  //       "content-length": body.length
	  //     }

	  //     stream.on("data", () => {
	  //       console.log("data");
	  //     });
	  //     stream.headers(headers)
	  //     stream.write(body)
	  //     stream.end()
	  //     console.log("written")
	  //   });
	  // });
	};

	return Connection;
};

function validateOptions(options) {
	for (var key in options) {
		if (options[key] === null || options[key] === undefined) {
			debug("Option [" + key + "] set to null. This may cause unexpected behaviour.");
		}
	}
}

function configureAddress(options) {
	if (!options.address) {
		if (options.production) {
			options.address = EndpointAddress.production;
		}
		else {
			options.address = EndpointAddress.sandbox;
		}
	}
	else {
		if (options.address === EndpointAddress.production) {
			options.production = true;
		}
		else {
			options.production = false;
		}
	}
};

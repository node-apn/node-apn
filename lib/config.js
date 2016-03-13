"use strict";

const extend = require("./util/extend");

let EndpointAddress = {
	production: "api.push.apple.com",
	sandbox:    "api.sandbox.push.apple.com"
}

module.exports = function(dependencies) {
  const debug = dependencies.debug;
  const prepareCredentials = dependencies.prepareCredentials;

  function config(options) {
		let config = {
			cert: "cert.pem",
			key: "key.pem",
			ca: null,
			pfx: null,
			passphrase: null,
			production: (process.env.NODE_ENV === "production"),
			address: null,
			port: 443,
			rejectUnauthorized: true,
			connectTimeout: 10000,
			connectionTimeout: 3600000,
			connectionRetryLimit: 10,
		};

		validateOptions(options);

		extend(config, options);
		configureAddress(config);
		
		if (config.pfx || config.pfxData) {
			config.cert = options.cert;
			config.key = options.key;
		}

    extend(config, prepareCredentials(config));
    return config;
  }

  function validateOptions(options) {
    for (var key in options) {
      if (options[key] === null || options[key] === undefined) {
        debug("Option [" + key + "] is " +  options[key] + ". This may cause unexpected behaviour.");
      }
    }
  }

  return config;
};

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

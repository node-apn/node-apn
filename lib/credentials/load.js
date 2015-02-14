"use strict";

var q    = require("q");
var sysu = require("util");

var resolve = require("./resolve");

function loadCredentials(credentials) {

	// Prepare PKCS#12 data if available
	var pfxPromise = resolve(credentials.pfx || credentials.pfxData);

	// Prepare Certificate data if available.
	var certPromise = resolve(credentials.cert || credentials.certData);

	// Prepare Key data if available
	var keyPromise = resolve(credentials.key || credentials.keyData);

	// Prepare Certificate Authority data if available.
	var caPromises = [];
	if (credentials.ca !== null) {
	 	if(!sysu.isArray(credentials.ca)) {
			credentials.ca = [ credentials.ca ];
		}
		credentials.ca.forEach(function(ca)  {
			caPromises.push(resolve(ca));
		});
	}
	if (caPromises.length === 0) {
		caPromises = undefined;
	}
	else {
		caPromises = q.all(caPromises);
	}

	return q.all([pfxPromise, certPromise, keyPromise, caPromises])
		.spread(function(pfx, cert, key, ca) {
			return { pfx: pfx, cert: cert, key: key, ca: ca, passphrase: credentials.passphrase };
	});
}

module.exports = loadCredentials;
"use strict";

var resolve = require("./resolve");

function loadCredentials(credentials) {

	// Prepare PKCS#12 data if available
	var pfx = resolve(credentials.pfx || credentials.pfxData);

	// Prepare Certificate data if available.
	var cert = resolve(credentials.cert || credentials.certData);

	// Prepare Key data if available
	var key = resolve(credentials.key || credentials.keyData);

	// Prepare Certificate Authority data if available.
	var ca = [];

	if (credentials.ca !== null) {
	 	if(!Array.isArray(credentials.ca)) {
			credentials.ca = [ credentials.ca ];
		}
		ca = credentials.ca.map( resolve );
	}
	if (ca.length === 0) {
		ca = undefined;
	}

	return { pfx: pfx, cert: cert, key: key, ca: ca, passphrase: credentials.passphrase };
}

module.exports = loadCredentials;

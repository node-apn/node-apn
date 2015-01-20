var fs   = require('fs');
var q    = require('q');
var sysu = require('util');

var readCredential = require('./read');

function loadCredentials(credentials) {

	// Prepare PKCS#12 data if available
	var pfxPromise = readCredential(credentials.pfx || credentials.pfxData);

	// Prepare Certificate data if available.
	var certPromise = readCredential(credentials.cert || credentials.certData);

	// Prepare Key data if available
	var keyPromise = readCredential(credentials.key || credentials.keyData);

	// Prepare Certificate Authority data if available.
	var caPromises = [];
	if (credentials.ca != null && !sysu.isArray(credentials.ca)) {
		credentials.ca = [ credentials.ca ];
	}
	for(var i in credentials.ca) {
		var ca = credentials.ca[i];
		caPromises.push(readCredential(ca));
	}
	if (caPromises.length == 0) {
		delete caPromises;
	}
	else {
		caPromises = q.all(caPromises);
	}

	return q.all([pfxPromise, certPromise, keyPromise, caPromises]);
}

module.exports = loadCredentials;
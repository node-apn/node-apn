var fs   = require('fs');
var q    = require('q');
var sysu = require('util');

function Credentials(credentials) {
	var readFile = q.nfbind(fs.readFile);

	// Prepare PKCS#12 data if available
	var pfxPromise = null;
	if(credentials.pfx != null || credentials.pfxData != null) {
		if(credentials.pfxData) {
			pfxPromise = credentials.pfxData;
		}
		else if(Buffer.isBuffer(credentials.pfx)) {
			pfxPromise = credentials.pfx;
		}
		else {
			pfxPromise = readFile(credentials.pfx);
		}
	}

	// Prepare Certificate data if available.
	var certPromise = null;
	if (credentials.certData) {
		certPromise = credentials.certData;
	}
	else if(Buffer.isBuffer(credentials.cert) || checkPEMType(credentials.cert, "CERTIFICATE")) {
		certPromise = credentials.cert;
	}
	else if(credentials.cert){
		// Nothing has matched so attempt to load from disk
		certPromise = readFile(credentials.cert);
	}

	// Prepare Key data if available
	var keyPromise = null;
	if (credentials.keyData) {
		keyPromise = credentials.keyData;
	}
	else if(Buffer.isBuffer(credentials.key) || checkPEMType(credentials.key, "PRIVATE KEY")) {
		keyPromise = credentials.key;
	}
	else if(credentials.key) {
		keyPromise = readFile(credentials.key);
	}

	// Prepare Certificate Authority data if available.
	var caPromises = [];
	if (credentials.ca != null && !sysu.isArray(credentials.ca)) {
		credentials.ca = [ credentials.ca ];
	}
	for(var i in credentials.ca) {
		var ca = credentials.ca[i];
		if(Buffer.isBuffer(ca) || checkPEMType(ca, "CERTIFICATE")) {
			caPromises.push(ca);
		}
		else if (ca){
			caPromises.push(readFile(ca));
		}
	}
	if (caPromises.length == 0) {
		caPromises = undefined;
	}
	else {
		caPromises = q.all(caPromises);
	}

	return q.all([pfxPromise, certPromise, keyPromise, caPromises]);
}

function checkPEMType(input, type) {
	if (input == null) {
		return false;
	}
	var matches = input.match(/\-\-\-\-\-BEGIN ([A-Z\s*]+)\-\-\-\-\-/);
	
	if (matches != null) {
		return matches[1].indexOf(type) >= 0;
	}
	return false;
}

module.exports = Credentials;
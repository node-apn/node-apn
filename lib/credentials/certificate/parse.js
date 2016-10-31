"use strict";

module.exports = function (dependencies) {
	var parsePkcs12 = dependencies.parsePkcs12;
	var parsePemKey = dependencies.parsePemKey;
	var parsePemCert = dependencies.parsePemCert;
	function parse(credentials) {
		var parsed = {};

		parsed.key = parsePemKey(credentials.key, credentials.passphrase);
		parsed.certificates = parsePemCert(credentials.cert);

		var pkcs12Parsed = parsePkcs12(credentials.pfx, credentials.passphrase);
		if (pkcs12Parsed) {
			parsed.key = pkcs12Parsed.key;
			parsed.certificates = pkcs12Parsed.certificates;
		}

		return parsed;
	}

	return parse;
};
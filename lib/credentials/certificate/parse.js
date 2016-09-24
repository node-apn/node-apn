"use strict";

module.exports = function (dependencies) {
	const parsePkcs12 = dependencies.parsePkcs12;
	const parsePemKey = dependencies.parsePemKey;
	const parsePemCert = dependencies.parsePemCert;
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
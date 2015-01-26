var parsePkcs12 = require("./parsePkcs12");
var parsePemKey = require("./parsePemKey");
var parsePemCert = require("./parsePemCertificate");

var parse = function parse(credentials) {
	var parsed = {};

	parsed.key = parsePemKey(credentials.key, credentials.passphrase) || parsed.key;
	parsed.cert = parsePemCert(credentials.cert) || parsed.cert;
	parsed.production = credentials.production;

	var pkcs12Parsed = parsePkcs12(credentials.pfx, credentials.passphrase);
	if (pkcs12Parsed) {
		parsed.key = pkcs12Parsed.key;
		parsed.cert = pkcs12Parsed.cert;
	}

	return parsed;
};

module.exports = parse;
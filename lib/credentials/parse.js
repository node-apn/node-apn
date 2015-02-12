var parsePkcs12 = require("./parsePkcs12");
var parsePemKey = require("./parsePemKey");
var parsePemCert = require("./parsePemCertificate");

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

module.exports = parse;
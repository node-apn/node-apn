var forge = require("node-forge");
var oids = require("./oids")

var pemCertificateProperties = function(certData) {
	var cert;

	try{
		cert = forge.pki.certificateFromPem(certData.toString());
	}
	catch (e) {
		return {
			"error": e
		};
	}

	var publicKeyFingerprint = forge.pki.getPublicKeyFingerprint(cert.publicKey, {"encoding": "hex"});

	var sandbox = false,
		production = false;
	if (cert.getExtension({ "id": oids.applePushServiceClientDevelopment })) {
		sandbox = true;
	}
	else if (cert.getExtension({ "id": oids.applePushServiceClientProduction })) {
		production = true;
	}

	var commonName = cert.subject.getField({ "shortName": "CN" }).value;

	return {
		"validity": cert.validity,
		"pkFingerprint": publicKeyFingerprint,
		"environment": { 
			"sandbox": sandbox,
			"production": production
		},
		"subject": {
			"commonName": commonName
		}
	}
}

module.exports = pemCertificateProperties;
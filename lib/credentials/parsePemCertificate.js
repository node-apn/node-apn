"use strict";

var forge = require("node-forge");

var APNCertificate = require("./APNCertificate");

function apnCertificateFromPem(certData) {
	if (!certData) {
		return null;
	}

	var pemMessages;
	try {
		pemMessages = forge.pem.decode(certData);
	}
	catch (e) {
		if (e.message.match("Invalid PEM formatted message.")) {
			throw new Error("unable to parse certificate, not a valid PEM file");
		}
	}
	var certificates = [];

	for(var i in pemMessages) {
		var certMessage = pemMessages[i];
		if (!certMessage.type.match(new RegExp("CERTIFICATE$"))) {
			continue;
		}
		var certAsn1 = forge.asn1.fromDer(certMessage.body);
		var forgeCertificate = forge.pki.certificateFromAsn1(certAsn1);

		certificates.push(new APNCertificate(forgeCertificate));
	}
	return certificates;
}

module.exports = apnCertificateFromPem;
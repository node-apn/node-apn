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

	pemMessages.forEach(function(message) {
		if (!message.type.match(new RegExp("CERTIFICATE$"))) {
			return;
		}
		var certAsn1 = forge.asn1.fromDer(message.body);
		var forgeCertificate = forge.pki.certificateFromAsn1(certAsn1);

		certificates.push(new APNCertificate(forgeCertificate));
	});
	return certificates;
}

module.exports = apnCertificateFromPem;
"use strict";

var forge = require("node-forge");

var APNKey = require("../../lib/credentials/APNKey");
var APNCertificate = require("../../lib/credentials/APNCertificate");

function decryptPkcs12FromAsn1(asn1, passphrase) {
	try {
		return forge.pkcs12.pkcs12FromAsn1(asn1, false, passphrase);
	}
	catch (e) {
		// OpenSSL-exported files need an empty string, if no password was specified 
		// during export.
		if (passphrase) {
			throw e;
		}
		return forge.pkcs12.pkcs12FromAsn1(asn1, false, "");
	}
}

function apnCredentialsFromPkcs12(p12Data, passphrase) {
	if (!p12Data) {
		return;
	}

	var asn1 = forge.asn1.fromDer(p12Data.toString("binary"), false);
	var pkcs12;
	try {
		pkcs12 = decryptPkcs12FromAsn1(asn1, passphrase);
	}
	catch(e) {
		if (e.message.match("Invalid password")) {
			throw new Error("unable to parse credentials, incorrect passphrase");
		}
		else {
			throw new Error("unable to parse credentials, not a PFX/P12 file");
		}
	}

	var credentials = { "key": null, "certificates": []};
	for(var i in pkcs12.safeContents) {
		var safeContents = pkcs12.safeContents[i];

		for(var j in safeContents.safeBags) {
			var safeBag = safeContents.safeBags[j];

			if(safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
				if(credentials.key) {
					throw new Error("multiple keys found in PFX/P12 file");
				}
				credentials.key = new APNKey(safeBag.key);
			}
			else if(safeBag.type === forge.pki.oids.certBag) {
				credentials.certificates.push(new APNCertificate(safeBag.cert));
			}
		}
	}

	return credentials;
}

module.exports = apnCredentialsFromPkcs12;
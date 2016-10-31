"use strict";

var forge = require("node-forge");

var APNKey = require("./APNKey");
var APNCertificate = require("./APNCertificate");

function decryptPkcs12FromAsn1(asn1, passphrase) {
	try {
		return forge.pkcs12.pkcs12FromAsn1(asn1, false, passphrase);
	} catch (e) {
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
	var pkcs12 = void 0;
	try {
		pkcs12 = decryptPkcs12FromAsn1(asn1, passphrase);
	} catch (e) {
		if (e.message.match("Invalid password")) {
			throw new Error("unable to parse credentials, incorrect passphrase");
		} else {
			throw new Error("unable to parse credentials, not a PFX/P12 file");
		}
	}

	var credentials = { "key": null, "certificates": [] };
	pkcs12.safeContents.forEach(function (safeContents) {
		safeContents.safeBags.forEach(function (safeBag) {
			if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
				if (credentials.key) {
					throw new Error("multiple keys found in PFX/P12 file");
				}
				credentials.key = new APNKey(safeBag.key);
			} else if (safeBag.type === forge.pki.oids.certBag) {
				credentials.certificates.push(new APNCertificate(safeBag.cert));
			}
		});
	});

	return credentials;
}

module.exports = apnCredentialsFromPkcs12;
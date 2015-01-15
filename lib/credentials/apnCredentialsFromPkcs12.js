var forge = require("node-forge");

var APNKey = require("../../lib/credentials/APNKey");
var APNCertificate = require("../../lib/credentials/APNCertificate");

var apnCredentialsFromPkcs12 = function(p12Data, passphrase) {
	if (!p12Data) {
		return;
	}

	var asn1 = forge.asn1.fromDer(p12Data.toString('binary'), false);
	var pkcs12;
	try {
		try {
			pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, passphrase);
		}
		catch (e) {
			pkcs12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, "");
		}
	}
	catch(e) {
		if (e.message.match("Invalid password")) {
			throw new Error("unable to read credentials, incorrect passphrase");
		}
	}

	var credentials = { "key": null, "certificates": []};
	for(var i in pkcs12.safeContents) {
		var safeContents = pkcs12.safeContents[i];

		for(var j in safeContents.safeBags) {
			var safeBag = safeContents.safeBags[j];

			if(safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
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
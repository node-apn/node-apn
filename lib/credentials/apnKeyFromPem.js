var forge = require("node-forge");

var APNKey = require("./APNKey");

var apnKeyFromPem = function(keyPem, passphrase) {
	if (!keyPem) {
		return null;
	}

	var key;
	try {
		key = forge.pki.decryptRsaPrivateKey(keyPem, passphrase);
	}
	catch (e) {
		if (e.message.match(/Unsupported OID/)) {
			throw new Error("unable to load key, unsupported format: " + e.oid);
		}
		else if(e.message.match(/Could not convert private key from PEM; PEM header type is not/)) {
			throw new Error("unable to load key, not a private key");
		}
		else if(e.message.match(/Invalid PEM formatted message/)) {
			throw new Error("unable to load key, not a valid PEM file")
		}
	}

	if(!key) {
		var msg = forge.pem.decode(keyPem)[0];
		if ((msg.procType && msg.procType.type === 'ENCRYPTED')
			|| msg.type.match(/ENCRYPTED/)) {
			throw new Error("unable to load key, incorrect passphrase");
		}
	}

	return new APNKey(key);
}

module.exports = apnKeyFromPem;
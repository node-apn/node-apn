var forge = require("node-forge");

var APNKey = require("./APNKey");

var apnKeyFromPem = function(keyPem, passphrase) {
	if (!keyPem) {
		return null;
	}

	try {
		var apnKey = null;
		var pemMessages = forge.pem.decode(keyPem);
		for(var i in pemMessages) {
			var message = pemMessages[i];
			if (!message.type.match(/KEY/)) {
				continue;
			}

			var key = forge.pki.decryptRsaPrivateKey(forge.pem.encode(message), passphrase);

			if(!key) {
				if ((message.procType && message.procType.type === 'ENCRYPTED')
					|| message.type.match(/ENCRYPTED/)) {
					throw new Error("unable to load key, incorrect passphrase");
				}
			}
			else if(apnKey) {
				throw new Error("multiple keys found in PEM file");
			}
			else {
				apnKey = new APNKey(key);
			}
		}
		if (apnKey) {
			return apnKey;
		}
	}
	catch (e) {
		if (e.message.match(/Unsupported OID/)) {
			throw new Error("unable to load key, unsupported format: " + e.oid);
		}
		else if(e.message.match(/Invalid PEM formatted message/)) {
			throw new Error("unable to load key, not a valid PEM file");
		}
		else if (e.message.match(/multiple keys/)) {
			throw e;
		}
		else if (e.message.match(/unable to load key/)) {
			throw e;
		}
	}
	throw new Error("unable to load key, no private key found");
}

module.exports = apnKeyFromPem;

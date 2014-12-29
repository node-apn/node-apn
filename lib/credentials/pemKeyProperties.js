var forge = require('node-forge');

var pemKeyProperties = function(keyPem, passphrase) {
	if (!keyPem) {
		return {};
	}
	
	var privateKey = privateKeyFromPem(keyPem, passphrase);

	if (privateKey instanceof Error) {
		return { "error": privateKey };
	}

	return { "publicKeyFingerprint": publicKeyFingerprint(publicKey(privateKey)) };
};

var privateKeyFromPem = function(keyPem, passphrase) {
	var key;
	try {
		key = forge.pki.decryptRsaPrivateKey(keyPem, passphrase);
	}
	catch (err) {
		return err;
	}

	if (!key && isPemEncrypted(keyPem)) {
		return new Error("Could not decrypt key,  incorrect passphrase");
	}

	return key;
}

var isPemEncrypted = function(keyPem) {
	var msg = forge.pem.decode(keyPem)[0];
	if (msg.type.match(/ENCRYPTED/) || msg.procType.type === 'ENCRYPTED') {
		return true;
	}
}

var publicKey = function(key) {
	return forge.pki.setRsaPublicKey(key.n, key.e)
}

var publicKeyFingerprint = function(publicKey, encoding) {
	return forge.pki.getPublicKeyFingerprint(publicKey, {encoding: 'hex'});
}

module.exports = pemKeyProperties;
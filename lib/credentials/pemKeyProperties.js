var forge = require('node-forge');

var pemKeyProperties = function(keyPem, passphrase) {
	if (!keyPem) {
		return {};
	}
	var key = forge.pki.decryptRsaPrivateKey(keyPem, passphrase);
	if (!key) {
		var msg = forge.pem.decode(keyPem)[0];
		if (msg.type.match(/ENCRYPTED/) || msg.procType.type === 'ENCRYPTED') {
			throw("Could not decrypt key, incorrect passphrase");
		}
	}
	return {
		"publicKeyFingerprint": publicKeyFingerprint(publicKey(key))
	};
};

var publicKey = function(key) {
	return forge.pki.setRsaPublicKey(key.n, key.e)
}

var publicKeyFingerprint = function(publicKey, encoding) {
	return forge.pki.getPublicKeyFingerprint(publicKey, {encoding: 'hex'});
}

module.exports = pemKeyProperties;
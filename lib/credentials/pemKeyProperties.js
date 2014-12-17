var forge = require('node-forge');

var pemKeyProperties = function(keyPem) {
	var key = forge.pki.privateKeyFromPem(keyPem);
	var publicKey = forge.pki.setRsaPublicKey(key.n, key.e);
	var fingerprint = forge.pki.getPublicKeyFingerprint(publicKey, {encoding: 'hex'});
	return {
		"publicKeyFingerprint": fingerprint
	};
};

module.exports = pemKeyProperties;
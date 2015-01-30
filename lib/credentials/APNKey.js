var forge = require("node-forge");

var APNKey = function APNKey(key) {
	if(!key || !key.n || !key.e) {
		throw new Error("key is not a valid public key");
	}

	this._key = key;
}

APNKey.prototype.fingerprint = function() {
	return forge.pki.getPublicKeyFingerprint(this._key, {encoding: 'hex'});
}

module.exports = APNKey;
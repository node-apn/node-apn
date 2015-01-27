var validateCredentials = function(credentials) {
	if (credentials.key.fingerprint() !== credentials.cert.key().fingerprint()) {
		throw new Error("certificate and key do not match");
	}

	var validity = credentials.cert.validity();
	if (validity.notAfter.getTime() < Date.now()) {
		throw new Error("certificate has expired: " + validity.notAfter.toJSON());
	}

	var environment = credentials.cert.environment();
	if ( (credentials.production && !environment.production) ||
		(!credentials.production && !environment.sandbox)) {
		throw new Error("certificate does not support configured environment, production: " + credentials.production);
	}
};

module.exports = validateCredentials;
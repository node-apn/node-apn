"use strict";

const APNKey = require("./APNKey");
const oids = require("./oids");

function APNCertificate(cert) {
	if(!cert.publicKey || !cert.validity || !cert.subject) {
		throw new Error("certificate object is invalid");
	}

	this._cert = cert;
}

APNCertificate.prototype.key = function() {
	return new APNKey(this._cert.publicKey);
};

APNCertificate.prototype.validity = function() {
	return this._cert.validity;
};

APNCertificate.prototype.environment = function() {
	let environment = { sandbox: false, production: false };
	
	if (this._cert.getExtension({ "id": oids.applePushServiceClientDevelopment })) {
		environment.sandbox = true;
	}

	if (this._cert.getExtension({ "id": oids.applePushServiceClientProduction })) {
		environment.production = true;
	}
	return environment;
};

module.exports = APNCertificate;
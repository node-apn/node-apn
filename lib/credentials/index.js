"use strict";

module.exports = function (dependencies) {
	var logger = dependencies.logger;

	var resolve = require("./resolve");

	var parseCertificate = require("./certificate/parse")({
		parsePkcs12: require("./certificate/parsePkcs12"),
		parsePemKey: require("./certificate/parsePemKey"),
		parsePemCert: require("./certificate/parsePemCertificate")
	});

	var loadCertificate = require("./certificate/load")({
		resolve: resolve
	});

	var prepareCertificate = require("./certificate/prepare")({
		load: loadCertificate,
		parse: parseCertificate,
		validate: require("./certificate/validate"),
		logger: logger
	});

	var sign = require("jsonwebtoken/sign");

	var prepareToken = require("./token/prepare")({
		sign: sign,
		resolve: resolve
	});

	var prepareCA = require("./ca/prepare")({
		resolve: resolve
	});

	return {
		certificate: prepareCertificate,
		token: prepareToken,
		ca: prepareCA
	};
};
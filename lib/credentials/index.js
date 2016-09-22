
module.exports = function (dependencies) {
	const logger = dependencies.logger;

	const resolve = require("./resolve");

	const parseCertificate = require("./certificate/parse")({
		parsePkcs12:  require("./certificate/parsePkcs12"),
		parsePemKey:  require("./certificate/parsePemKey"),
		parsePemCert: require("./certificate/parsePemCertificate"),
	});

	const loadCertificate = require("./certificate/load")({
		resolve
	});

	const prepareCertificate = require("./certificate/prepare")({
		load: loadCertificate,
		parse: parseCertificate,
		validate: require("./certificate/validate"),
		logger: logger,
	});

	return {
	  certificate: prepareCertificate,
	  // token: prepareToken,
	};
};

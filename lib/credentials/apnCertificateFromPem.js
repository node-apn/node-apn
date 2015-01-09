var forge = require("node-forge");

var APNCertificate = require("./APNCertificate");
var oids = require("./oids");

var apnCertificateFromPem = function(certData) {
	if (!certData) {
		return null;
	}
	var forgeCertificate = forge.pki.certificateFromPem(certData.toString());
	return new APNCertificate(forgeCertificate);
}

module.exports = apnCertificateFromPem;
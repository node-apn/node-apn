var apnCertificateFromPem = require("../../lib/credentials/apnCertificateFromPem");
var APNCertificate = require("../../lib/credentials/APNCertificate");
var fs = require("fs");

describe("apnCertificateFromPem", function() {
	describe("with PEM certificate", function() {
		var cert, certProperties;
		before(function() {
			cert = fs.readFileSync("test/credentials/support/cert.pem");
		});

		beforeEach(function() {
			certProperties = apnCertificateFromPem(cert);
		});

		it("returns an APNCertificate", function() {
			expect(certProperties).to.be.an.instanceof(APNCertificate);
		});

		it("returns correct certificate data", function() {
			expect(certProperties.key().fingerprint()).to.equal("2d594c9861227dd22ba5ae37cc9354e9117a804d");
		});
	})

	describe("throws", function() {
		it("for a PEM key", function() {
			var key = fs.readFileSync("test/credentials/support/key.pem");
			expect(function() {
				apnCertificateFromPem(key);
			}).to.throw(Error);
		});

		it("for a PKCS#12 file", function() {
			var pfx = fs.readFileSync("test/credentials/support/test.p12");
			expect(function() {
				apnCertificateFromPem(pfx);
			}).to.throw(Error);
		});

	});
	
	describe("returns null", function() {
		it("for null", function() {
			expect(apnCertificateFromPem(null)).to.be.null;
		});

		it("for undefined", function() {
			expect(apnCertificateFromPem(undefined)).to.be.null;
		})
	});
});
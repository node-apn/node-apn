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

		describe("return value", function() {
			it("is an array", function() {
				expect(certProperties).to.be.an('array');
			});

			it("contains one element", function() {
				expect(certProperties).to.have.length(1);
			});

			describe("certificate [0]", function() {
				it("is an APNCertificate", function() {
					expect(certProperties[0]).to.be.an.instanceof(APNCertificate);
				});

				it("has the correct fingerprint", function() {
					expect(certProperties[0].key().fingerprint()).to.equal("2d594c9861227dd22ba5ae37cc9354e9117a804d");
				});
			});
		});
	});

	describe("with PEM containing multiple certificates", function() {
		var cert, certProperties;
		before(function() {
			cert = fs.readFileSync("test/credentials/support/certIssuerKey.pem");
		});

		beforeEach(function() {
			certProperties = apnCertificateFromPem(cert);
		});

		it("returns the correct number of certificates", function() {
			expect(certProperties).to.have.length(2);
		});

		describe("certificate [0]", function() {
			it("has the correct fingerprint", function() {
				expect(certProperties[0].key().fingerprint()).to.equal("2d594c9861227dd22ba5ae37cc9354e9117a804d");
			});
		});

		describe("certificate [1]", function() {
			it("has the correct fingerprint", function() {
				expect(certProperties[1].key().fingerprint()).to.equal("ccff221d67cb3335649f9b4fbb311948af76f4b2");
			});
		});
	});

	describe("with a PKCS#12 file", function() {
		it("throws", function() {
			var pfx = fs.readFileSync("test/credentials/support/test.p12");
			expect(function() {
				apnCertificateFromPem(pfx);
			}).to.throw("unable to load certificate, not a valid PEM file");
		});
	});

	describe("with a key", function() {
		it("returns an empty array", function() {
			var key = fs.readFileSync("test/credentials/support/key.pem");
			expect(apnCertificateFromPem(key)).to.be.empty;
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
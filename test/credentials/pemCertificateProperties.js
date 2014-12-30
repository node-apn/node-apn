var pemCertificateProperties = require("../../lib/credentials/pemCertificateProperties");
var fs = require("fs");

describe("pemCertificateProperties", function() {
	describe("returns metadata for PEM certificate", function() {
		var cert, certProperties;
		before(function() {
			cert = fs.readFileSync("test/credentials/support/cert.pem");
		});

		beforeEach(function() {
			certProperties = pemCertificateProperties(cert);
		});

		it("includes validity", function() {
			expect(certProperties.validity).to.eql({
				notBefore: new Date("2014-12-16T23:27:18"),
				notAfter: new Date("2024-12-16T23:27:18")
			});
		});

		it("includes public key fingerprint", function() {
			expect(certProperties.pkFingerprint).to.equal("2d594c9861227dd22ba5ae37cc9354e9117a804d");
		});

		it("includes common name", function() {
			expect(certProperties.subject.commonName).to.equal("Apple Development IOS Push Services: io.apn.test");
		});

		describe("includes environment", function() {
			describe("development certificate", function() {
				it("sandbox is true", function() {
					expect(certProperties.environment.sandbox).to.be.true;
				});

				it("production is false", function() {
					expect(certProperties.environment.production).to.be.false;
				});
			});

			describe("production certificate", function() {
				var productionCert, prodCertProperties;
				before(function() {
					productionCert = fs.readFileSync("test/credentials/support/certProduction.pem");
				});
				
				beforeEach(function() {
					prodCertProperties = pemCertificateProperties(productionCert);
				});

				it("sandbox is false", function() {
					expect(prodCertProperties.environment.sandbox).to.be.false;
				});

				it("production is true", function() {
					expect(prodCertProperties.environment.production).to.be.true;
				});
			});
		});
	});
	describe("returns object containing error", function() {
		it("for a PEM key", function() {
			var key = fs.readFileSync("test/credentials/support/key.pem");
			expect(pemCertificateProperties(key).error).to.be.an.instanceof(Error);
		});

		it("for a PKCS#12 file", function() {
			var pfx = fs.readFileSync("test/credentials/support/test.p12");
			expect(pemCertificateProperties(pfx).error).to.be.an.instanceof(Error);
		});

		it("for null", function() {
			expect(pemCertificateProperties().error).to.be.an.instanceof(Error);
		});
	});
});
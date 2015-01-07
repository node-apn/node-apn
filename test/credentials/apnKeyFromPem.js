var apnKeyFromPem = require("../../lib/credentials/apnKeyFromPem");
var APNKey = require("../../lib/credentials/APNKey");
var fs = require("fs");

describe("apnKeyFromPem", function() {
	describe("returns APNKey", function() {
		describe("RSA key", function() {
			beforeEach(function() {
				var keyData = fs.readFileSync("test/credentials/support/key.pem");
				key = apnKeyFromPem(keyData);
			});

			it("correct type", function() {	
				expect(key).to.be.an.instanceof(APNKey);
			});

			it("with correct fingerprint", function() {
				expect(key.fingerprint()).to.equal("2d594c9861227dd22ba5ae37cc9354e9117a804d")
			});
		});

		it("openssl-encrypted RSA key, correct password", function() {
			var key = fs.readFileSync("test/credentials/support/keyEncrypted.pem");
			expect(apnKeyFromPem(key, "apntest")).to.be.an.instanceof(APNKey);
		});

		it("PKCS#8 encrypted key, correct password", function() {
			var key = fs.readFileSync("test/credentials/support/keyPKCS8Enc.pem");
			expect(apnKeyFromPem(key, "apntest")).to.be.an.instanceof(APNKey);
		});

		it("PEM containing certificates and key", function() {
			var certAndKey = fs.readFileSync("test/credentials/support/certAndKey.pem");
			expect(apnKeyFromPem(certAndKey)).to.be.an.instanceof(APNKey);
		});
	});

	describe("throws with", function() {
		it("PKCS#8 key (unsupported format)", function() {
			var key = fs.readFileSync("test/credentials/support/keyPKCS8.pem");
			expect(function() {
				apnKeyFromPem(key);
			}).to.throw("unable to load key, unsupported format");
		});

		it("RSA encrypted key, incorrect passphrase", function() {
			var key = fs.readFileSync("test/credentials/support/keyEncrypted.pem");
			expect(function() {
				apnKeyFromPem(key, "not-the-passphrase");
			}).to.throw("unable to load key, incorrect passphrase");
		});

		it("PKCS#8 encrypted key, incorrect passphrase", function() {
			var key = fs.readFileSync("test/credentials/support/keyPKCS8Enc.pem");
			expect(function() {
				apnKeyFromPem(key, "not-the-passphrase");
			}).to.throw("unable to load key, incorrect passphrase");
		});
		
		it("PEM certificate", function() {
			var cert = fs.readFileSync("test/credentials/support/cert.pem");
			expect(function() {
				apnKeyFromPem(cert);
			}).to.throw("unable to load key, no private key found");
		});
		
		it("PKCS#12 file", function() {
			var pkcs12 = fs.readFileSync("test/credentials/support/test.p12");
			expect(function() {
				apnKeyFromPem(pkcs12);
			}).to.throw("unable to load key, not a valid PEM file");
		});
	});

	describe("returns null", function() {
		it("for null", function() {
			expect(apnKeyFromPem()).to.be.null
		});

		it("for undefined", function() {
			expect(apnKeyFromPem()).to.be.null
		});
	});
});
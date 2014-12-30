var pemKeyProperties = require("../../lib/credentials/pemKeyProperties");
var fs = require("fs");

describe("pemKeyProperties", function() {
	describe("returns metadata", function() {
		describe("plain key", function() {
			it("includes public key fingerprint", function() {
				var key = fs.readFileSync("test/credentials/support/key.pem");
				keyProperties = pemKeyProperties(key);
				expect(keyProperties.publicKeyFingerprint).to.equal("2d594c9861227dd22ba5ae37cc9354e9117a804d");
			});
		});

		describe("openssl-encrypted key, correct password", function() {
			it("includes public key fingerprint", function() {
				var key = fs.readFileSync("test/credentials/support/keyEncrypted.pem");
				keyProperties = pemKeyProperties(key, "apntest");
				expect(keyProperties.publicKeyFingerprint).to.equal("0706311384a1f60dfb4566c9aede8782b0734061");
			});
		});
	});

	describe("returns object containing error with", function() {
		it("PKCS#8 key, unsupported format", function() {
			var key = fs.readFileSync("test/credentials/support/keyPKCS8.pem");
			expect(pemKeyProperties(key).error)
				.to.be.an.instanceof(Error);
		});

		it("encrypted key, wrong password", function() {
			var key = fs.readFileSync("test/credentials/support/keyEncrypted.pem");
			expect(pemKeyProperties(key).error)
				.to.be.an.instanceof(Error);
		});
		
		it("PEM certificate", function() {
			var cert = fs.readFileSync("test/credentials/support/cert.pem");
			expect(pemKeyProperties(cert).error)
				.to.be.an.instanceof(Error);
		});
		
		it("PKCS#12 file", function() {
			var pkcs12 = fs.readFileSync("test/credentials/support/test.p12");
			expect(pemKeyProperties(pkcs12).error)
				.to.be.an.instanceof(Error);
		});
		
		it("null", function() {
			expect(pemKeyProperties()).to.eql({});
		});
	});
});
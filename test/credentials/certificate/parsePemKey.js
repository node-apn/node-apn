"use strict";

const parsePemKey = require("../../../src/credentials/certificate/parsePemKey");
const APNKey = require("../../../src/credentials/certificate/APNKey");
const fs = require("fs");

describe("parsePemKey", function() {
	describe("returns APNKey", function() {
		describe("RSA key", function() {
			let key;
			beforeEach(function() {
				let keyData = fs.readFileSync("test/credentials/support/key.pem");
				key = parsePemKey(keyData);
			});

			it("correct type", function() {	
				expect(key).to.be.an.instanceof(APNKey);
			});

			it("with correct fingerprint", function() {
				expect(key.fingerprint()).to.equal("2d594c9861227dd22ba5ae37cc9354e9117a804d");
			});
		});

		it("openssl-encrypted RSA key, correct password", function() {
			let key = fs.readFileSync("test/credentials/support/keyEncrypted.pem");
			expect(parsePemKey(key, "apntest")).to.be.an.instanceof(APNKey);
		});

		it("PKCS#8 encrypted key, correct password", function() {
			let key = fs.readFileSync("test/credentials/support/keyPKCS8Encrypted.pem");
			expect(parsePemKey(key, "apntest")).to.be.an.instanceof(APNKey);
		});

		it("PEM containing certificates and key", function() {
			let certAndKey = fs.readFileSync("test/credentials/support/certKey.pem");
			expect(parsePemKey(certAndKey)).to.be.an.instanceof(APNKey);
		});
	});

	describe("throws with", function() {
		it("PKCS#8 key (unsupported format)", function() {
			let key = fs.readFileSync("test/credentials/support/keyPKCS8.pem");
			expect(function() {
				parsePemKey(key);
			}).to.throw("unable to parse key, unsupported format");
		});

		it("RSA encrypted key, incorrect passphrase", function() {
			let key = fs.readFileSync("test/credentials/support/keyEncrypted.pem");
			expect(function() {
				parsePemKey(key, "not-the-passphrase");
			}).to.throw("unable to parse key, incorrect passphrase");
		});

		it("PKCS#8 encrypted key, incorrect passphrase", function() {
			let key = fs.readFileSync("test/credentials/support/keyPKCS8Encrypted.pem");
			expect(function() {
				parsePemKey(key, "not-the-passphrase");
			}).to.throw("unable to parse key, incorrect passphrase");
		});
		
		it("PEM certificate", function() {
			let cert = fs.readFileSync("test/credentials/support/cert.pem");
			expect(function() {
				parsePemKey(cert);
			}).to.throw("unable to parse key, no private key found");
		});
		
		it("PKCS#12 file", function() {
			let pkcs12 = fs.readFileSync("test/credentials/support/certIssuerKey.p12");
			expect(function() {
				parsePemKey(pkcs12);
			}).to.throw("unable to parse key, not a valid PEM file");
		});
	});

	describe("multiple keys", function() {
		it("throws", function() {
			let keys = fs.readFileSync("test/credentials/support/multipleKeys.pem");
			expect(function() {
				parsePemKey(keys);
			}).to.throw("multiple keys found in PEM file");
		});
	});

	describe("returns null", function() {
		it("for null", function() {
			expect(parsePemKey()).to.be.null;
		});

		it("for undefined", function() {
			expect(parsePemKey()).to.be.null;
		});
	});
});
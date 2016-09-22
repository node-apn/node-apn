"use strict";

const parsePemCertificate = require("../../../lib/credentials/certificate/parsePemCertificate");
const APNCertificate = require("../../../lib/credentials/certificate/APNCertificate");
const fs = require("fs");

describe("parsePemCertificate", function() {
	describe("with PEM certificate", function() {
		let cert, certProperties;
		before(function() {
			cert = fs.readFileSync("test/credentials/support/cert.pem");
		});

		beforeEach(function() {
			certProperties = parsePemCertificate(cert);
		});

		describe("return value", function() {
			it("is an array", function() {
				expect(certProperties).to.be.an("array");
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
		let cert, certProperties;
		before(function() {
			cert = fs.readFileSync("test/credentials/support/certIssuerKey.pem");
		});

		beforeEach(function() {
			certProperties = parsePemCertificate(cert);
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
			let pfx = fs.readFileSync("test/credentials/support/certIssuerKey.p12");
			expect(function() {
				parsePemCertificate(pfx);
			}).to.throw("unable to parse certificate, not a valid PEM file");
		});
	});

	describe("with a key", function() {
		it("returns an empty array", function() {
			let key = fs.readFileSync("test/credentials/support/key.pem");
			expect(parsePemCertificate(key)).to.be.empty;
		});
	});
	
	describe("returns null", function() {
		it("for null", function() {
			expect(parsePemCertificate(null)).to.be.null;
		});

		it("for undefined", function() {
			expect(parsePemCertificate(undefined)).to.be.null;
		});
	});
});
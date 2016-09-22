"use strict";

var resolve = require("../../lib/credentials/resolve");
var fs = require("fs");

describe("resolve", function() {
	var pfx, cert, key;
	before(function () {
		pfx = fs.readFileSync("test/support/initializeTest.pfx");
		cert = fs.readFileSync("test/support/initializeTest.crt");
		key = fs.readFileSync("test/support/initializeTest.key");
	});

	it("returns PEM string as supplied", function() {
		expect(resolve(cert.toString()))
			.to.be.a("string")
			.and.to.equal(cert.toString());
	});

	it("returns Buffer as supplied", function() {
		expect(resolve(pfx))
			.to.satisfy(Buffer.isBuffer)
			.and.to.equal(pfx);
	});

	describe("with file path", function() {
		it("returns a Buffer for valid path", function() {
			return expect(resolve("test/support/initializeTest.key"))
						 .to.satisfy(Buffer.isBuffer);
		});
		
		it("returns contents for value path", function () {
			return expect(resolve("test/support/initializeTest.key")
				.toString()).to.equal(key.toString());
		});

		it("throws for invalid path", function() {
			return expect(() => { resolve("test/support/fail/initializeTest.key") })
				.to.throw;
		});
	});

	it("returns null/undefined as supplied", function() {
		expect(resolve(null)).to.be.null;
		expect(resolve()).to.be.undefined;
	});
});

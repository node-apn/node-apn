var CredentialLoader = require("../lib/credentialLoader");

var fs = require("fs");

describe("CredentialLoader", function() {
	var pfx, cert, key;
	before(function () {
		pfx = fs.readFileSync("test/support/initializeTest.pfx");
		cert = fs.readFileSync("test/support/initializeTest.crt");
		key = fs.readFileSync("test/support/initializeTest.key");
	});

	it("returns PEM string as supplied", function() {
		expect(CredentialLoader(cert.toString()))
			.to.be.a('string')
			.and.to.equal(cert.toString());
	});

	it("returns Buffer as supplied", function() {
		expect(CredentialLoader(pfx))
			.to.satisfy(Buffer.isBuffer)
			.and.to.equal(pfx);
	});

	describe("with file path", function() {
		it("eventually returns a Buffer for valid path", function() {
			return expect(CredentialLoader("test/support/initializeTest.key"))
						 .to.eventually.satisfy(Buffer.isBuffer);
		});
		
		it("eventually returns contents for value path", function () {
			return expect(CredentialLoader("test/support/initializeTest.key")
				.post("toString")).to.eventually.equal(key.toString());
		});

		it("is eventually rejected with invalid path", function() {
			return expect(CredentialLoader("test/support/fail/initializeTest.key"))
				.to.eventually.be.rejected;
		});
	});

	it("returns null/undefined as supplied", function() {
		expect(CredentialLoader(null)).to.be.null;
		expect(CredentialLoader()).to.be.undefined;
	});
});
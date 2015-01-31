var sinon = require("sinon");
var rewire = require("rewire");
var parseCredentials = rewire("../../lib/credentials/parse");

var fs = require("fs");
var APNCertificate = require("../../lib/credentials/APNCertificate");
var APNKey = require("../../lib/credentials/APNKey");

describe("parseCredentials", function() {	
	describe("with PFX file", function() {
		var pfxData, parsed;
		before(function() {
			pfxData = fs.readFileSync("test/credentials/support/certIssuerKeyPassphrase.p12");
			parsed = parseCredentials({ pfx: pfxData, passphrase: "apntest" });
		});

		it("returns the parsed key", function() {
			expect(parsed.key).to.be.an.instanceof(APNKey);
		});

		it("returns the parsed certificates", function() {
			expect(parsed.certificates[0]).to.be.an.instanceof(APNCertificate);
		});

		it("throws when passphrase is incorrect", function() {
			expect(function() {
				parseCredentials({ pfx: pfxData, passphrase: "incorrectpassphrase" });
			}).to.throw(/incorrect passphrase/);
		});

		it("throws when passphrase is not supplied", function() {
			expect(function() {
				parseCredentials({ pfx: pfxData });
			}).to.throw(/incorrect passphrase/);
		});
	});

	describe("with PEM key", function() {
		var keyData;

		before(function() {
			keyData = fs.readFileSync("test/credentials/support/keyEncrypted.pem");
		});

		it("returns the parsed key", function() {
			// Set the passphrase to "pempassphrase" to see some weird behaviour.
			// "Too few bytes to read ASN.1 value.". Change passphrase to anything else and it
			// changes to an "incorrect passphrase" error. Weird.
			var parsed = parseCredentials({ key: keyData, passphrase: "apntest" });
			expect(parsed.key).to.be.an.instanceof(APNKey);
		});

		it("throws when passphrase is incorrect", function() {
			expect(function() {
				parseCredentials({ key: keyData, passphrase: "incorrectpassphrase" });
			}).to.throw(/incorrect passphrase/);
		});

		it("throws when passphrase is not supplied", function() {
			expect(function() {
				parseCredentials({ key: keyData });
			}).to.throw(/incorrect passphrase/);
		});
	});

	describe("with PEM certificate", function() {
		it("returns the parsed certificate", function() {
			var certData = fs.readFileSync("test/credentials/support/cert.pem");
			var parsed = parseCredentials({ cert: certData });
			expect(parsed.certificates[0]).to.be.an.instanceof(APNCertificate);
		});
	});

	it("passes production flag through", function() {
		var parsed = parseCredentials({ production: true });
		expect(parsed.production).to.eql(true);
	});

	describe("both PEM and PFX data is supplied", function() {
		var reset;
		before(function() {
			var pkcs12Spy = sinon.stub();
			pkcs12Spy.withArgs("pfx").returns({ key: "pfxkey", certificates: ["pfxcert"] });

			var pemKeySpy = sinon.stub();
			pemKeySpy.withArgs("pemkey").returns("parsedpemkey");

			var pemCertSpy = sinon.stub();
			pemCertSpy.withArgs("pemcert").returns("parsedpemcert");

			reset = parseCredentials.__set__({
				"parsePkcs12": pkcs12Spy,
				"parsePemKey": pemKeySpy,
				"parsePemCert": pemCertSpy,
			});
		});

		after(function() {
			reset();
		});

		it("it prefers PFX to PEM", function() {
			var parsed = parseCredentials({ pfx: "pfx", key: "pemkey", cert: "pemcert"});
			expect(parsed.key).to.eql("pfxkey");
			expect(parsed.certificates[0]).to.eql("pfxcert");
		});
	});
});
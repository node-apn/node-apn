var sinon = require("sinon");
var rewire = require("rewire");
var parseCredentials = rewire("../../lib/credentials/parse");

describe("parseCredentials", function() {
	var pkcs12Spy, pemKeySpy, pemCertSpy;
	before(function() {
		pkcs12Spy = sinon.stub();
		pkcs12Spy.withArgs("pfx").returns({ key: "pfxkey", cert: "pfxcert" });
		pkcs12Spy.withArgs("pfxencrypted", "pfxpassphrase").returns({ key: "decryptedpfxkey", cert: "pfxcert" });
		pkcs12Spy.withArgs("pfxencrypted", "incorrectpassphrase").throws();
		pkcs12Spy.withArgs("pfxencrypted").throws();
		parseCredentials.__set__("parsePkcs12", pkcs12Spy);

		pemKeySpy = sinon.stub();
		pemKeySpy.withArgs("pemkey").returns("parsedpemkey");
		pemKeySpy.withArgs("pemkeyencrypted", "pempassphrase").returns("decryptedpemkey");
		pemKeySpy.withArgs("pemkeyencrypted", "incorrectpassphrase").throws();
		pemKeySpy.withArgs("pemkeyencrypted").throws();
		parseCredentials.__set__("parsePemKey", pemKeySpy);

		pemCertSpy = sinon.stub();
		pemCertSpy.withArgs("pemcert").returns("parsedpemcert");
		parseCredentials.__set__("parsePemCert", pemCertSpy);
	});

	describe("with PFX file", function() {
		it("returns the parsed key", function() {
			var parsed = parseCredentials({pfx:"pfx"});
			expect(parsed.key).to.equal("pfxkey");
		});

		it("returns the parsed key", function() {
			var parsed = parseCredentials({pfx:"pfx"});
			expect(parsed.cert).to.eql("pfxcert" );
		});

		describe("having passphrase", function() {
			it("returns the parsed key", function() {
				var parsed = parseCredentials({pfx: "pfxencrypted", passphrase: "pfxpassphrase" });
				expect(parsed.key).to.eql("decryptedpfxkey");
			});

			it("throws when passphrase is incorrect", function() {
				expect(function() {
					parseCredentials({ pfx: "pfxencrypted", passphrase: "incorrectpassphrase" });
				}).to.throw();
			});
			it("throws when passphrase is not supplied", function() {
				expect(function() {
					parseCredentials({ pfx: "pfxencrypted"});
				}).to.throw();
			});
		});
	});

	describe("with PEM key", function() {
		it("returns the parsed key", function() {
			var parsed = parseCredentials({ key: "pemkey" });
			expect(parsed.key).to.eql("parsedpemkey");
		});

		describe("having passphrase", function() {
			it("returns the parsed key", function() {
				var parsed = parseCredentials({ key: "pemkeyencrypted", passphrase: "pempassphrase" });
				expect(parsed.key).to.eql("decryptedpemkey");
			});

			it("throws when passphrase is incorrect", function() {
				expect(function() {
					parseCredentials({ key: "pemkeyencrypted", passphrase: "incorrectpassphrase" });
				}).to.throw();
			});
			it("throws when passphrase is not supplied", function() {
				expect(function() {
					parseCredentials({ key: "pemkeyencrypted"});
				}).to.throw();
			});
		});
	});

	describe("with PEM certificate", function() {
		it("returns the parsed certificate", function() {
			var parsed = parseCredentials({ cert: "pemcert" });
			expect(parsed.cert).to.eql("parsedpemcert");
		});
	});

	it("passes production flag through", function() {
		var parsed = parseCredentials({ production: true });
		expect(parsed.production).to.eql(true);
	});

	it("prefers PFX to PEM", function() {
		var parsed = parseCredentials({ pfx: "pfx", key: "pemkey", cert: "pemcert"});
		expect(parsed.key).to.eql("pfxkey");
		expect(parsed.cert).to.eql("pfxcert");
	});
});
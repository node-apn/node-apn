var sinon = require("sinon");
var rewire = require("rewire");
var parseCredentials = rewire("../../lib/credentials/parse");

var APNCertificate = require("../../lib/credentials/APNCertificate");
var APNKey = require("../../lib/credentials/APNKey");

describe("parseCredentials", function() {
	var reset;
	var pkcs12Spy, pemKeySpy, pemCertSpy;
	
	var pfxKey = new APNKey({n: 1, e: 1 });
	var pfxCert = new APNCertificate({publicKey: {}, validity: {}, subject: {} });

	var pemKey = new APNKey({n: 2, e: 1 });
	var pemCert = new APNCertificate({publicKey: {}, validity: {}, subject: {} });
	
	beforeEach(function() {
		pkcs12Spy = sinon.stub();

		pemKeySpy = sinon.stub();
		pemKeySpy.withArgs("pemkey").returns(pemKey);

		pemCertSpy = sinon.stub();
		pemCertSpy.withArgs("pemcert").returns(pemCert);

		reset = parseCredentials.__set__({
			"parsePkcs12": pkcs12Spy,
			"parsePemKey": pemKeySpy,
			"parsePemCert": pemCertSpy,
		});
	});

	afterEach(function() {
		reset();
	});

	describe("with PFX file", function() {
		it("returns the parsed key", function() {
			pkcs12Spy.withArgs("pfxData").returns({ key: pfxKey, certificates: [pfxCert] });

			var parsed = parseCredentials({ pfx: "pfxData" });
			expect(parsed.key).to.be.an.instanceof(APNKey);
		});

		it("returns the parsed certificates", function() {
			pkcs12Spy.withArgs("pfxData").returns({ key: pfxKey, certificates: [pfxCert] });

			var parsed = parseCredentials({ pfx: "pfxData" });
			expect(parsed.certificates[0]).to.be.an.instanceof(APNCertificate);
		});

		describe("having passphrase", function() {
			beforeEach(function() {
				pkcs12Spy.withArgs("encryptedPfxData", "apntest").returns({ key: pfxKey, certificates: [pfxCert] });
				pkcs12Spy.withArgs("encryptedPfxData", sinon.match.any).throws(new Error("unable to read credentials, incorrect passphrase"));
			});
			
			it("returns the parsed key", function() {
				var parsed = parseCredentials({ pfx: "encryptedPfxData", passphrase: "apntest" });
				expect(parsed.key).to.be.an.instanceof(APNKey);
			});

			it("throws when passphrase is incorrect", function() {
				expect(function() {
					parseCredentials({ pfx: "encryptedPfxData", passphrase: "incorrectpassphrase" });
				}).to.throw(/incorrect passphrase/);
			});

			it("throws when passphrase is not supplied", function() {
				expect(function() {
					parseCredentials({ pfx: "encryptedPfxData" });
				}).to.throw(/incorrect passphrase/);
			});
		});
	});

	describe("with PEM key", function() {
		it("returns the parsed key", function() {
			pemKeySpy.withArgs("pemKeyData").returns(pemKey);

			var parsed = parseCredentials({ key: "pemKeyData" });
			expect(parsed.key).to.be.an.instanceof(APNKey);
		});

		describe("having passphrase", function() {
			beforeEach(function() {
				pemKeySpy.withArgs("encryptedPemKeyData", "apntest").returns(pemKey);
				pemKeySpy.withArgs("encryptedPemKeyData", sinon.match.any).throws(new Error("unable to load key, incorrect passphrase"));
			});

			it("returns the parsed key", function() {
				var parsed = parseCredentials({ key: "encryptedPemKeyData", passphrase: "apntest" });
				expect(parsed.key).to.be.an.instanceof(APNKey);
			});

			it("throws when passphrase is incorrect", function() {
				expect(function() {
					parseCredentials({ key: "encryptedPemKeyData", passphrase: "incorrectpassphrase" });
				}).to.throw(/incorrect passphrase/);
			});

			it("throws when passphrase is not supplied", function() {
				expect(function() {
					parseCredentials({ key: "encryptedPemKeyData" });
				}).to.throw(/incorrect passphrase/);
			});
		});
	});

	describe("with PEM certificate", function() {
		it("returns the parsed certificate", function() {
			pemCertSpy.withArgs("pemCertData").returns([pemCert]);

			var parsed = parseCredentials({ cert: "pemCertData" });
			expect(parsed.certificates[0]).to.be.an.instanceof(APNCertificate);
		});
	});

	describe("both PEM and PFX data is supplied", function() {
		it("it prefers PFX to PEM", function() {
			pkcs12Spy.withArgs("pfxData").returns({ key: pfxKey, certificates: [pfxCert] });
			pemKeySpy.withArgs("pemKeyData").returns(pemKey);
			pemCertSpy.withArgs("pemCertData").returns([pemCert]);

			var parsed = parseCredentials({ pfx: "pfxData", key: "pemKeyData", cert: "pemCertData"});
			expect(parsed.key).to.equal(pfxKey);
			expect(parsed.certificates[0]).to.equal(pfxCert);
		});
	});
});
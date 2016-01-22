"use strict";

const events = require("events");
const sinon = require("sinon");
const lolex = require("lolex");
const Promise = require("bluebird");

describe("Connection", function() {
	const fakes = {
		credentials: {
			loadStub: sinon.stub(),
			parseStub: sinon.stub(),
			validateStub: sinon.stub(),
		},
		EndpointManager: sinon.stub(),
	}

	const Connection = require("../lib/connection")(fakes)

	describe("constructor", function () {
		let originalEnv;

		before(function() {
			originalEnv = process.env.NODE_ENV;
		});

		after(function() {
			process.env.NODE_ENV = originalEnv;
		});

		beforeEach(function() {
			process.env.NODE_ENV = "";
			fakes.EndpointManager.reset();
		});

		// Issue #50
		it("should use api.sandbox.push.apple.com as the default connection address", function () {
			expect(Connection().options.address).to.equal("api.sandbox.push.apple.com");
		});

		it("should use api.push.apple.com when NODE_ENV=production", function () {
			process.env.NODE_ENV = "production";
			expect(Connection().options.address).to.equal("api.push.apple.com");
		});

		it("should give precedence to production flag over NODE_ENV=production", function () {
			process.env.NODE_ENV = "production";
			expect(Connection({ production: false }).options.address).to.equal("api.sandbox.push.apple.com");
		});

		it("should use api.push.apple.com when production:true", function () {
			expect(Connection({production:true}).options.address).to.equal("api.push.apple.com");
		});

		it("should use a custom address when passed", function () {
			expect(Connection({address: "testaddress"}).options.address).to.equal("testaddress");
		});

		describe("address is passed", function() {
			it("sets production to true when using production address", function() {
				expect(Connection({address: "api.push.apple.com"}).options.production).to.be.true;
			});

			it("sets production to false when using sandbox address", function() {
				process.env.NODE_ENV = "production";
				expect(Connection({address: "api.sandbox.push.apple.com"}).options.production).to.be.false;
			});
		});

		it("creates an EndpointManager", function() {
			var options = { address: "api.push.apple.com" }
			var connection = Connection(options);

			expect(fakes.EndpointManager).to.be.calledOnce;
			expect(fakes.EndpointManager).to.be.calledWithNew;
		});
	});

	xdescribe("#loadCredentials", function () {
		var loadStub, parseStub, validateStub, removeStubs;
		beforeEach(function() {
			

			removeStubs = Connection.__set__("credentials", {
				"load": loadStub,
				"parse": parseStub,
				"validate": validateStub,
			});
		});

		afterEach(function() {
			removeStubs();
		});

		it("only loads credentials once", function() {
			loadStub.returns(Promise.resolve({}));
			parseStub.returnsArg(0);

			var connection = Connection();
			connection.loadCredentials();
			connection.loadCredentials();
			expect(loadStub).to.be.calledOnce;
		});

		describe("with valid credentials", function() {
			var credentials;
			var testOptions = {
				pfx: "myCredentials.pfx", cert: "myCert.pem", key: "myKey.pem", ca: "myCa.pem",
				passphrase: "apntest", production: true
			};

			beforeEach(function() {
				loadStub.withArgs(sinon.match(function(v) {
					return v.pfx === "myCredentials.pfx" && v.cert === "myCert.pem" && v.key === "myKey.pem" &&
						v.ca === "myCa.pem" && v.passphrase === "apntest";
				})).returns(Promise.resolve({ pfx: "myPfxData", cert: "myCertData", key: "myKeyData", ca: ["myCaData"], passphrase: "apntest" }));

				parseStub.returnsArg(0);

				credentials = Connection(testOptions).loadCredentials();
			});

			it("should be fulfilled", function () {
				return expect(credentials).to.be.fulfilled;
			});

			describe("the validation stage", function() {
				it("is called once", function() {
					return credentials.finally(function() {
						expect(validateStub).to.be.calledOnce;
					});
				});

				it("is passed the production flag", function() {
					return credentials.finally(function() {
						expect(validateStub.getCall(0).args[0]).to.have.property("production", true);
					});
				});

				describe("passed credentials", function() {
					it("contains the PFX data", function() {
						return credentials.finally(function() {
							expect(validateStub.getCall(0).args[0]).to.have.property("pfx", "myPfxData");
						});
					});

					it("contains the key data", function() {
						return credentials.finally(function() {
							expect(validateStub.getCall(0).args[0]).to.have.property("key", "myKeyData");
						});
					});

					it("contains the certificate data", function() {
						return credentials.finally(function() {
							expect(validateStub.getCall(0).args[0]).to.have.property("cert", "myCertData");
						});
					});

					it("includes passphrase", function() {
						return credentials.finally(function() {
							expect(validateStub.getCall(0).args[0]).to.have.property("passphrase", "apntest");
						});
					});
				});
			});

			describe("resolution value", function() {
				it("contains the PFX data", function() {
					return expect(credentials).to.eventually.have.property("pfx", "myPfxData");
				});

				it("contains the key data", function() {
					return expect(credentials).to.eventually.have.property("key", "myKeyData");
				});

				it("contains the certificate data", function() {
					return expect(credentials).to.eventually.have.property("cert", "myCertData");
				});

				it("contains the CA data", function() {
					return expect(credentials).to.eventually.have.deep.property("ca[0]", "myCaData");
				});

				it("includes passphrase", function() {
					return expect(credentials).to.eventually.have.property("passphrase", "apntest");
				});
			});
		});

		describe("credential file cannot be parsed", function() {
			beforeEach(function() {
				loadStub.returns(Promise.resolve({ cert: "myCertData", key: "myKeyData" }));
				parseStub.throws(new Error("unable to parse key"));
			});

			it("should resolve with the credentials", function() {
				var credentials = Connection({ cert: "myUnparseableCert.pem", key: "myUnparseableKey.pem" }).loadCredentials();
				return expect(credentials).to.become({ cert: "myCertData", key: "myKeyData" });
			});

			it("should log an error", function() {
				var debug = sinon.spy();
				var reset = Connection.__set__("debug", debug);
				var credentials = Connection({ cert: "myUnparseableCert.pem", key: "myUnparseableKey.pem" }).loadCredentials();

				return credentials.finally(function() {
					reset();
					expect(debug).to.be.calledWith(sinon.match(function(err) {
						return err.message ? err.message.match(/unable to parse key/) : false;
					}, "\"unable to parse key\""));
				});
			});

			it("should not attempt to validate", function() {
				var credentials = Connection({ cert: "myUnparseableCert.pem", key: "myUnparseableKey.pem" }).loadCredentials();
				return credentials.finally(function() {
					expect(validateStub).to.not.be.called;
				});
			});
		});

		describe("credential validation fails", function() {
			it("should be rejected", function() {
				loadStub.returns(Promise.resolve({ cert: "myCertData", key: "myMismatchedKeyData" }));
				parseStub.returnsArg(0);
				validateStub.throws(new Error("certificate and key do not match"));

				var credentials = Connection({ cert: "myCert.pem", key: "myMistmatchedKey.pem" }).loadCredentials();
				return expect(credentials).to.eventually.be.rejectedWith(/certificate and key do not match/);
			});
		});

		describe("credential file cannot be loaded", function() {
			it("should be rejected", function() {
				loadStub.returns(Promise.reject(new Error("ENOENT, no such file or directory")));

				var credentials = Connection({ cert: "noSuchFile.pem", key: "myKey.pem" }).loadCredentials();
				return expect(credentials).to.eventually.be.rejectedWith("ENOENT, no such file or directory");
			});
		});
	});

	describe("pushNotification", () => {});
});

function notificationDouble() {
	return {
		payload: { aps: { badge: 1 } },
		compile: function() { return JSON.stringify(this.payload); }
	};
}

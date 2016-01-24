"use strict";

const sinon = require("sinon");
const Promise = require("bluebird");

describe("Connection", function() {
	let fakes, Connection;

	beforeEach(() => {
		fakes = {
			credentials: {
				load: sinon.stub(),
				parse: sinon.stub(),
				validate: sinon.stub(),
			},
			EndpointManager: sinon.stub(),
		}

		Connection = require("../lib/connection")(fakes)
	})

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

	describe("#loadCredentials", function () {
		it("only loads credentials once", function() {
			fakes.credentials.load.returns(Promise.resolve({}));
			fakes.credentials.parse.returnsArg(0);

			var connection = Connection();
			connection.loadCredentials();
			connection.loadCredentials();
			expect(fakes.credentials.load).to.be.calledOnce;
		});

		describe("with valid credentials", function() {
			let credentials;
			const testOptions = {
				pfx: "myCredentials.pfx",
				cert: "myCert.pem",
				key: "myKey.pem",
				ca: "myCa.pem",
				passphrase: "apntest",
				production: true,
			};

			beforeEach(function() {
				fakes.credentials.load.withArgs(sinon.match(testOptions)).returns(
					Promise.resolve({
						pfx: "myPfxData",
						cert: "myCertData",
						key: "myKeyData",
						ca: ["myCaData"],
						passphrase: "apntest",
					})
				);

				fakes.credentials.parse.returnsArg(0);
				credentials = Connection(testOptions).loadCredentials();
			});

			it("should be fulfilled", function () {
				return expect(credentials).to.be.fulfilled;
			});

			describe("the validation stage", function() {
				it("is called once", function() {
					return credentials.finally(function() {
						expect(fakes.credentials.validate).to.be.calledOnce;
					});
				});

				it("is passed the production flag", function() {
					return credentials.finally(function() {
						expect(fakes.credentials.validate.getCall(0).args[0]).to.have.property("production", true);
					});
				});

				describe("passed credentials", function() {
					it("contains the PFX data", function() {
						return credentials.finally(function() {
							expect(fakes.credentials.validate.getCall(0).args[0]).to.have.property("pfx", "myPfxData");
						});
					});

					it("contains the key data", function() {
						return credentials.finally(function() {
							expect(fakes.credentials.validate.getCall(0).args[0]).to.have.property("key", "myKeyData");
						});
					});

					it("contains the certificate data", function() {
						return credentials.finally(function() {
							expect(fakes.credentials.validate.getCall(0).args[0]).to.have.property("cert", "myCertData");
						});
					});

					it("includes passphrase", function() {
						return credentials.finally(function() {
							expect(fakes.credentials.validate.getCall(0).args[0]).to.have.property("passphrase", "apntest");
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
				fakes.credentials.load.returns(Promise.resolve({ cert: "myCertData", key: "myKeyData" }));
				fakes.credentials.parse.throws(new Error("unable to parse key"));
			});

			it("should resolve with the credentials", function() {
				var credentials = Connection({ cert: "myUnparseableCert.pem", key: "myUnparseableKey.pem" }).loadCredentials();
				return expect(credentials).to.become({ cert: "myCertData", key: "myKeyData" });
			});

			xit("should log an error", function() {
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
					expect(fakes.credentials.validate).to.not.be.called;
				});
			});
		});

		describe("credential validation fails", function() {
			it("should be rejected", function() {
				fakes.credentials.load.returns(Promise.resolve({ cert: "myCertData", key: "myMismatchedKeyData" }));
				fakes.credentials.parse.returnsArg(0);
				fakes.credentials.validate.throws(new Error("certificate and key do not match"));

				let credentials = Connection({ cert: "myCert.pem", key: "myMistmatchedKey.pem" }).loadCredentials();
				return expect(credentials).to.eventually.be.rejectedWith(/certificate and key do not match/);
			});
		});

		describe("credential file cannot be loaded", function() {
			it("should be rejected", function() {
				fakes.credentials.load.returns(Promise.reject(new Error("ENOENT, no such file or directory")));

				let credentials = Connection({ cert: "noSuchFile.pem", key: "myKey.pem" }).loadCredentials();
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

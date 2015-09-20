var rewire = require("rewire");
var Feedback = rewire("../lib/feedback");

var sinon = require("sinon");
var Q = require("q");

describe("Feedback", function() {
	var startMethod;
	before(function() {
		// Constructor has side effects :-(
		startMethod = Feedback.prototype.start;
		Feedback.prototype.start = function() { };
	});

	after(function() {
		Feedback.prototype.start = startMethod;
	});

	describe("constructor", function () {
		var originalEnv;

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
		it("should use feedback.sandbox.push.apple.com as the default Feedback address", function () {
			expect(Feedback().options.address).to.equal("feedback.sandbox.push.apple.com");
		});

		it("should use feedback.push.apple.com when NODE_ENV=production", function () {
			process.env.NODE_ENV = "production";
			expect(Feedback().options.address).to.equal("feedback.push.apple.com");
		});

		it("should use feedback.push.apple.com when production:true", function () {
			expect(Feedback({production:true}).options.address).to.equal("feedback.push.apple.com");
		});

		it("should give precedence to production flag over NODE_ENV=production", function () {
			process.env.NODE_ENV = "production";
			expect(Feedback({ production: false }).options.address).to.equal("feedback.sandbox.push.apple.com");
		});

		it("should use a custom address when passed", function () {
			expect(Feedback({address: "testaddress"}).options.address).to.equal("testaddress");
		});

		describe("address is passed", function() {
			it("sets production to true when using production address", function() {
				expect(Feedback({address: "feedback.push.apple.com"}).options.production).to.be.true;
			});

			it("sets production to false when using sandbox address", function() {
				process.env.NODE_ENV = "production";
				expect(Feedback({address: "feedback.sandbox.push.apple.com"}).options.production).to.be.false;
			});
		});
	});

	describe("#loadCredentials", function () {
		var loadStub, parseStub, validateStub, removeStubs;
		beforeEach(function() {
			loadStub = sinon.stub();
			loadStub.displayName = "loadCredentials";

			parseStub = sinon.stub();
			parseStub.displayName = "parseCredentials";
			
			validateStub = sinon.stub();
			validateStub.displayName = "validateCredentials";

			removeStubs = Feedback.__set__({
				"loadCredentials": loadStub,
				"parseCredentials": parseStub,
				"validateCredentials": validateStub,
			});
		});

		afterEach(function() {
			removeStubs();
		});

		it("only loads credentials once", function() {
			loadStub.returns(Q({}));

			var feedback = Feedback();
			feedback.loadCredentials();
			feedback.loadCredentials();
			expect(loadStub).to.be.calledOnce;
		});

		describe("with valid credentials", function() {
			var initialization;
			var testOptions = { 
				pfx: "myCredentials.pfx", cert: "myCert.pem", key: "myKey.pem", ca: "myCa.pem",
				passphrase: "apntest", production: true
			};

			beforeEach(function() {
				loadStub.withArgs(sinon.match(function(v) {
					return v.pfx === "myCredentials.pfx" && v.cert === "myCert.pem" && v.key === "myKey.pem" && 
						v.ca === "myCa.pem" && v.passphrase === "apntest";
				})).returns(Q({ pfx: "myPfxData", cert: "myCertData", key: "myKeyData", ca: ["myCaData"], passphrase: "apntest" }));

				parseStub.returnsArg(0);

				initialization = Feedback(testOptions).loadCredentials();
			});

			it("should be fulfilled", function () {
				return expect(initialization).to.be.fulfilled;
			});

			describe("the validation stage", function() {
				it("is called once", function() {
					return initialization.finally(function() {
						expect(validateStub).to.be.calledOnce;
					});
				});

				it("is passed the production flag", function() {
					return initialization.finally(function() {
						expect(validateStub.getCall(0).args[0]).to.have.property("production", true);
					});
				});

				describe("passed credentials", function() {
					it("contains the PFX data", function() {
						return initialization.finally(function() {
							expect(validateStub.getCall(0).args[0]).to.have.property("pfx", "myPfxData");
						});
					});

					it("contains the key data", function() {
						return initialization.finally(function() {
							expect(validateStub.getCall(0).args[0]).to.have.property("key", "myKeyData");
						});
					});

					it("contains the certificate data", function() {
						return initialization.finally(function() {
							expect(validateStub.getCall(0).args[0]).to.have.property("cert", "myCertData");
						});
					});

					it("includes passphrase", function() {
						return initialization.finally(function() {
							expect(validateStub.getCall(0).args[0]).to.have.property("passphrase", "apntest");
						});
					});
				});
			});

			describe("resolution value", function() {
				it("contains the PFX data", function() {
					return expect(initialization).to.eventually.have.property("pfx", "myPfxData");
				});

				it("contains the key data", function() {
					return expect(initialization).to.eventually.have.property("key", "myKeyData");
				});

				it("contains the certificate data", function() {
					return expect(initialization).to.eventually.have.property("cert", "myCertData");
				});

				it("contains the CA data", function() {
					return expect(initialization).to.eventually.have.deep.property("ca[0]", "myCaData");
				});

				it("includes passphrase", function() {
					return expect(initialization).to.eventually.have.property("passphrase", "apntest");
				});
			});
		});

		describe("credential file cannot be parsed", function() {
			beforeEach(function() {
				loadStub.returns(Q({ cert: "myCertData", key: "myKeyData" }));
				parseStub.throws(new Error("unable to parse key"));
			});

			it("should resolve with the credentials", function() {
				var initialization = Feedback({ cert: "myUnparseableCert.pem", key: "myUnparseableKey.pem" }).loadCredentials();
				return expect(initialization).to.become({ cert: "myCertData", key: "myKeyData" });
			});

			it("should log an error", function() {
				var debug = sinon.spy();
				var reset = Feedback.__set__("debug", debug);
				var initialization = Feedback({ cert: "myUnparseableCert.pem", key: "myUnparseableKey.pem" }).loadCredentials();

				return initialization.finally(function() {
					reset();
					expect(debug).to.be.calledWith(sinon.match(function(err) {
						return err.message ? err.message.match(/unable to parse key/) : false;
					}, "\"unable to parse key\""));
				});
			});

			it("should not attempt to validate", function() {
				var initialization = Feedback({ cert: "myUnparseableCert.pem", key: "myUnparseableKey.pem" }).loadCredentials();
				return initialization.finally(function() {
					expect(validateStub).to.not.be.called;
				});
			});
		});

		describe("credential validation fails", function() {
			it("should be rejected", function() {
				loadStub.returns(Q({ cert: "myCertData", key: "myMismatchedKeyData" }));
				parseStub.returnsArg(0);
				validateStub.throws(new Error("certificate and key do not match"));

				var initialization = Feedback({ cert: "myCert.pem", key: "myMistmatchedKey.pem" }).loadCredentials();
				return expect(initialization).to.eventually.be.rejectedWith(/certificate and key do not match/);
			});
		});

		describe("credential file cannot be loaded", function() {
			it("should be rejected", function() {
				loadStub.returns(Q.reject(new Error("ENOENT, no such file or directory")));

				var initialization = Feedback({ cert: "noSuchFile.pem", key: "myKey.pem" }).loadCredentials();
				return expect(initialization).to.eventually.be.rejectedWith("ENOENT, no such file or directory");
			});
		});
	});

	describe("createSocket", function() {
		var socketStub, removeSocketStub;

		before(function() {
			var loadCredentialsStub = sinon.stub(Feedback.prototype, "loadCredentials");
			loadCredentialsStub.returns(Q({ 
				pfx: "pfxData",
				key: "keyData",
				cert: "certData",
				ca: ["caData1", "caData2"],
				passphrase: "apntest" }));
		});
		
		beforeEach(function() {
			socketStub = sinon.stub();
			socketStub.callsArg(2);
			socketStub.returns({ on: function() {}, once: function() {}, end: function() {} });

			removeSocketStub = Feedback.__set__("createSocket", socketStub);
		});

		afterEach(function() {
			removeSocketStub();
		});

		it("loads credentials", function(done) {
			var feedback = Feedback({ pfx: "myCredentials.pfx" });
			return feedback.createSocket().finally(function() {
				expect(feedback.loadCredentials).to.have.been.calledOnce;
				done();
			});
		});

		describe("with valid credentials", function() {
			it("resolves", function() {
				var feedback = Feedback({
					cert: "myCert.pem",
					key: "myKey.pem"
				});
				return expect(feedback.createSocket()).to.be.fulfilled;
			});

			describe("the call to create socket", function() {
				var createSocket;

				it("passes PFX data", function() {
					createSocket = Feedback({
						pfx: "myCredentials.pfx",
						passphrase: "apntest"
					}).createSocket();
					return createSocket.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.pfx).to.equal("pfxData");
					});
				});

				it("passes the passphrase", function() {
					createSocket = Feedback({
						passphrase: "apntest",
						cert: "myCert.pem",
						key: "myKey.pem"
					}).createSocket();
					return createSocket.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.passphrase).to.equal("apntest");
					});
				});

				it("passes the cert", function() {
					createSocket = Feedback({
						cert: "myCert.pem",
						key: "myKey.pem"
					}).createSocket();
					return createSocket.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.cert).to.equal("certData");
					});
				});

				it("passes the key", function() {
					createSocket = Feedback({
						cert: "test/credentials/support/cert.pem",
						key: "test/credentials/support/key.pem"
					}).createSocket();
					return createSocket.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.key).to.equal("keyData");
					});
				});

				it("passes the ca certificates", function() {
					createSocket = Feedback({
						cert: "test/credentials/support/cert.pem",
						key: "test/credentials/support/key.pem",
						ca: [ "test/credentials/support/issuerCert.pem" ]
					}).createSocket();
					return createSocket.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.ca[0]).to.equal("caData1");
					});
				});
			});
		});

		describe("intialization failure", function() {
			it("is rejected", function() {
				var feedback = Feedback({ pfx: "a-non-existant-file-which-really-shouldnt-exist.pfx" });
				feedback.on("error", function() {});
				feedback.loadCredentials.returns(Q.reject(new Error("loadCredentials failed")));

				return expect(feedback.createSocket()).to.be.rejectedWith("loadCredentials failed");
			});
		});
	});

	describe("cancel", function() {
		it("should clear interval after cancel", function() {
			var feedback = new Feedback();
			feedback.interval = 1;
			feedback.cancel();
			expect(feedback.interval).to.be.undefined;
		});
	});
});
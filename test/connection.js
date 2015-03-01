var rewire = require("rewire");
var Connection = rewire("../lib/connection");

var events = require("events");
var sinon = require("sinon");
var Q = require("q");

describe("Connection", function() {
	describe('constructor', function () {
		var originalEnv;

		before(function() {
			originalEnv = process.env.NODE_ENV;
		});

		after(function() {
			process.env.NODE_ENV = originalEnv;
		})

		beforeEach(function() {
			process.env.NODE_ENV = "";
		})

		// Issue #50
		it("should use gateway.sandbox.push.apple.com as the default connection address", function () {
			expect(Connection().options.address).to.equal("gateway.sandbox.push.apple.com");
		});

		it("should use gateway.push.apple.com when NODE_ENV=production", function () {
			process.env.NODE_ENV = "production";
			expect(Connection().options.address).to.equal("gateway.push.apple.com");
		});

		it("should give precedence to production flag over NODE_ENV=production", function () {
			process.env.NODE_ENV = "production";
			expect(Connection({ production: false }).options.address).to.equal("gateway.sandbox.push.apple.com");
		});

		it("should use gateway.push.apple.com when production:true", function () {
			expect(Connection({production:true}).options.address).to.equal("gateway.push.apple.com");
		});

		it("should use a custom address when passed", function () {
			expect(Connection({address: "testaddress"}).options.address).to.equal("testaddress");
		});
		
		describe("address is passed", function() {
			it("sets production to true when using production address", function() {
				expect(Connection({address: "gateway.push.apple.com"}).options.production).to.be.true;
			});

			it("sets production to false when using sandbox address", function() {
				process.env.NODE_ENV = "production";
				expect(Connection({address: "gateway.sandbox.push.apple.com"}).options.production).to.be.false;
			});
		});
	});

	describe('#initialize', function () {
		var loadStub, parseStub, validateStub, removeStubs;
		beforeEach(function() {
			loadStub = sinon.stub();
			loadStub.displayName = "loadCredentials";

			parseStub = sinon.stub();
			parseStub.displayName = "parseCredentials";
			
			validateStub = sinon.stub();
			validateStub.displayName = "validateCredentials";

			removeStubs = Connection.__set__({
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

			var connection = Connection();
			connection.initialize();
			connection.initialize();
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

				initialization = Connection(testOptions).initialize();
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
				var initialization = Connection({ cert: "myUnparseableCert.pem", key: "myUnparseableKey.pem" }).initialize();
				return expect(initialization).to.become({ cert: "myCertData", key: "myKeyData" });
			});

			it("should log an error", function() {
				var debug = sinon.spy();
				var reset = Connection.__set__("debug", debug);
				var initialization = Connection({ cert: "myUnparseableCert.pem", key: "myUnparseableKey.pem" }).initialize();

				return initialization.finally(function() {
					reset();
					expect(debug).to.be.calledWith(sinon.match(function(err) {
						return err.message ? err.message.match(/unable to parse key/) : false;
					}, "\"unable to parse key\""));
				});
			});

			it("should not attempt to validate", function() {
				var initialization = Connection({ cert: "myUnparseableCert.pem", key: "myUnparseableKey.pem" }).initialize();
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

				var initialization = Connection({ cert: "myCert.pem", key: "myMistmatchedKey.pem" }).initialize();
				return expect(initialization).to.eventually.be.rejectedWith(/certificate and key do not match/);
			});
		});

		describe("credential file cannot be loaded", function() {
			it("should be rejected", function() {
				loadStub.returns(Q.reject(new Error("ENOENT, no such file or directory")));

				var initialization = Connection({ cert: "noSuchFile.pem", key: "myKey.pem" }).initialize();
				return expect(initialization).to.eventually.be.rejectedWith("ENOENT, no such file or directory");
			});
		});
	});

	describe("connect", function() {
		var socketDouble, socketStub, removeSocketStub;

		before(function() {
			var initializeStub = sinon.stub(Connection.prototype, "initialize");
			initializeStub.returns(Q({ 
				pfx: "pfxData",
				key: "keyData",
				cert: "certData",
				ca: ["caData1", "caData2"],
				passphrase: "apntest" }));
		});
		
		beforeEach(function() {
			socketDouble = new events.EventEmitter();
			socketDouble.end = sinon.spy();

			socketStub = sinon.stub();
			socketStub.callsArg(2);
			socketStub.returns(socketDouble);

			removeSocketStub = Connection.__set__("createSocket", socketStub);
		});

		afterEach(function() {
			socketDouble.removeAllListeners();
			removeSocketStub();
		});

		it("initializes the module", function(done) {
			var connection = Connection({ pfx: "myCredentials.pfx" });
			return connection.connect().finally(function() {
				expect(connection.initialize).to.have.been.calledOnce;
				done();
			});
		});

		describe("with valid credentials", function() {
			it("resolves", function() {
				var connection = Connection({
					cert: "myCert.pem",
					key: "myKey.pem"
				});
				return expect(connection.connect()).to.be.fulfilled;
			});

			describe("the call to create socket", function() {
				var connect;

				it("passes PFX data", function() {
					connect = Connection({
						pfx: "myCredentials.pfx",
						passphrase: "apntest"
					}).connect();
					return connect.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.pfx).to.equal("pfxData");
					});
				});

				it("passes the passphrase", function() {
					connect = Connection({
						passphrase: "apntest",
						cert: "myCert.pem",
						key: "myKey.pem"
					}).connect();
					return connect.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.passphrase).to.equal("apntest");
					});
				});

				it("passes the cert", function() {
					connect = Connection({
						cert: "myCert.pem",
						key: "myKey.pem"
					}).connect();
					return connect.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.cert).to.equal("certData");
					});
				});

				it("passes the key", function() {
					connect = Connection({
						cert: "test/credentials/support/cert.pem",
						key: "test/credentials/support/key.pem"
					}).connect();
					return connect.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.key).to.equal("keyData");
					});
				});

				it("passes the ca certificates", function() {
					connect = Connection({
						cert: "test/credentials/support/cert.pem",
						key: "test/credentials/support/key.pem",
						ca: [ "test/credentials/support/issuerCert.pem" ]
					}).connect();
					return connect.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.ca[0]).to.equal("caData1");
					});
				});
			});
		});

		describe("intialization failure", function() {
			it("is rejected", function() {
				var connection = Connection({ pfx: "a-non-existant-file-which-really-shouldnt-exist.pfx" });
				connection.on("error", function() {});
				connection.initialize = sinon.stub();

				connection.initialize.returns(Q.reject(new Error("initialize failed")));

				return expect(connection.connect()).to.be.rejectedWith("initialize failed");
			});
		});

		describe("timeout option", function() {
			var clock, timeoutRestore;
			beforeEach(function() {
				clock = sinon.useFakeTimers();
				timeoutRestore = Connection.__set__({
					"setTimeout": clock.setTimeout,
					"clearTimeout": clock.clearTimeout
				});
			});

			afterEach(function() {
				timeoutRestore();
				clock.restore();
			});

			it("ends the socket when connection takes too long", function() {
				var connection = Connection({connectTimeout: 3000}).connect();
				socketStub.onCall(0).returns(socketDouble);
				
				process.nextTick(function(){
					clock.tick(5000);
				});

				return connection.then(function() {
					throw "connection did not time out";
				}, function() {
					expect(socketDouble.end).to.have.been.called;
				});
			});

			it("does not end the socket when the connnection succeeds", function() {
				var connection = Connection({connectTimeout: 3000}).connect();

				return connection.then(function() {
					clock.tick(5000);
					expect(socketDouble.end).to.not.have.been.called;
				});
			});

			it("does not end the socket when the connection fails", function() {
				var connection = Connection({connectTimeout: 3000}).connect();
				socketStub.onCall(0).returns(socketDouble);
				
				process.nextTick(function() {
					socketDouble.emit("close");
				});

				return connection.then(function() {
					throw "connection should have failed";
				}, function() {
					clock.tick(5000);
					expect(socketDouble.end).to.not.have.been.called;
				});
			});

			it("disabled", function() {
				var connection = Connection({connectTimeout: 0}).connect();
				socketStub.onCall(0).returns(socketDouble);

				process.nextTick(function() {
					clock.tick(100000);
					socketDouble.emit("close");
				});

				return connection.then(function() {
					throw "connection should have failed";
				}, function() {
					expect(socketDouble.end).to.not.have.been.called;
				});
			});
		});
	});

	describe("validNotification", function() {
		describe("notification is shorter than max allowed", function() {
			it("returns true", function() {
				var connection = Connection();
				var notification = { length: function() { return 128; }};
				expect(connection.validNotification(notification)).to.equal(true);
			});
		});

		describe("notification is the maximum length", function() {
			it("returns true", function() {
				var connection = Connection();
				var notification = { length: function() { return 2048; }};
				expect(connection.validNotification(notification)).to.equal(true);
			});
		});

		describe("notification too long", function() {
			it("returns false", function() {
				var connection = Connection();
				var notification = { length: function() { return 2176; }};
				expect(connection.validNotification(notification)).to.equal(false);
			});
		});

		describe("VoIP flag set", function() {
			it("allows longer payload", function() {
				var connection = Connection({"voip": true});
				var notification = { length: function() { return 4096; }};
				expect(connection.validNotification(notification)).to.equal(true);
			});
		});
	});
});
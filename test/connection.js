var rewire = require("rewire");
var Connection = rewire("../lib/connection");

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
	});

	describe('#initialize', function () {
		describe("with valid credentials", function() {
			var initialization;
			before(function() {
				initialization = Connection({ cert: "test/credentials/support/cert.pem", key: "test/credentials/support/key.pem", passphrase: "apntest" }).initialize();
			});

			it("should be fulfilled", function () {
				return expect(initialization).to.be.fulfilled;
			});

			describe("resolution value", function() {
				it("contains the key data", function() {
					return expect(initialization.get("key")).to.eventually.have.length(1680);
				});

				it("includes passphrase", function() {
					return expect(initialization.get("passphrase")).to.eventually.equal("apntest");
				});
			});
		});

		describe("with sandbox certificate in production", function() {
			it("should be rejected", function() {
				var connection = Connection({ cert: "test/credentials/support/cert.pem", key: "test/credentials/support/key.pem", production: true });
				return expect(connection.initialize()).to.be.rejected;
			});
		}); 

		describe("with unreadable file", function() {
			it("should be fulfilled", function() {
				var connection = Connection({ pfx: "test/credentials/support/cert.pem" });
				return expect(connection.initialize()).to.eventually.be.fulfilled;
			});

			var reset;
			beforeEach(function() {
				reset = Connection.__set__("debug", sinon.spy());
			});

			afterEach(function() {
				reset();
			});

			it("should log an error", function() {
				var connection = Connection({ pfx: "test/credentials/support/cert.pem" });
				return connection.initialize().finally(function() {
					expect(Connection.__get__("debug")).to.be.calledWith(sinon.match(function(err) {
						return err.message ? err.message.match(/unable to read credentials/) : false;
					}, "\"unable to read credentials\""));
				});
			});
		});

		describe("with invalid file path", function() {
			it("should be rejected", function() {
				var connection = Connection({ pfx: "a-non-existant-file-which-really-shouldnt-exist.pfx" });
				return expect(connection.initialize()).to.eventually.be.rejected;
			});
		});
	});

	describe("connect", function() {
		var socketStub, removeSocketStub;

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
			socketStub = sinon.stub();
			socketStub.callsArg(2);
			socketStub.returns({ on: function() {}, once: function() {}, end: function() {} });

			removeSocketStub = Connection.__set__("createSocket", socketStub);
		});

		afterEach(function() {
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
				connection.initialize.returns(Q.reject(new Error("initialize failed")));

				return expect(connection.connect()).to.be.rejectedWith("initialize failed");
			});
		});
	});
});
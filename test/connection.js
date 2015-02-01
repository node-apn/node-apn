var rewire = require("rewire");
var Connection = rewire("../lib/connection");

var sinon = require("sinon");

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
		var socketStub, removeStub;
		before(function() {
			socketStub = sinon.stub();
			removeStub = Connection.__set__("createSocket", socketStub);
		});

		after(function() {
			removeStub();
		});

		afterEach(function() {
			socketStub.reset();
		});

		it("initializes the module", function(done) {
			socketStub.callsArg(2);
	 		socketStub.returns({ on: function() {}, once: function() {}, end: function() {} });

			var connection = Connection({ pfx: "myCredentials.pfx" });
			sinon.spy(connection, "initialize");
			connection.connect().finally(function() {
				expect(connection.initialize).to.have.been.calledOnce;
				connection.initialize.restore();
				done();
			});
		});

		describe("with valid credentials", function() {
			beforeEach(function() {
				socketStub.callsArg(2);
				socketStub.returns({ on: function() {}, once: function() {}, end: function() {} });
			});

			it("resolves", function() {
				var connection = Connection({
					cert: "test/credentials/support/cert.pem",
					key: "test/credentials/support/key.pem"
				});
				return expect(connection.connect()).to.be.fulfilled;
			});

			describe("the call to create socket", function() {
				var connect;

				it("passes PFX data", function() {
					connect = Connection({
						pfx: "test/credentials/support/certIssuerKeyPassphrase.p12",
						passphrase: "apntest"
					}).connect();
					return connect.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.pfx).to.have.length(3517);
					});
				});

				it("passes the passphrase", function() {
					connect = Connection({
						passphrase: "apntest",
						cert: "test/credentials/support/cert.pem",
						key: "test/credentials/support/key.pem"
					}).connect();
					return connect.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.passphrase).to.equal("apntest");
					});
				});

				it("passes the cert", function() {
					connect = Connection({
						cert: "test/credentials/support/cert.pem",
						key: "test/credentials/support/key.pem"
					}).connect();
					return connect.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.cert).to.have.length(1355);
					});
				});

				it("passes the key", function() {
					connect = Connection({
						cert: "test/credentials/support/cert.pem",
						key: "test/credentials/support/key.pem"
					}).connect();
					return connect.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.key).to.have.length(1680);
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
						expect(socketOptions.ca[0]).to.have.length(1285);
					});
				});
			});
		});

		describe("intialization failure", function() {
			it("is rejected", function() {
				var connection = Connection({ pfx: "a-non-existant-file-which-really-shouldnt-exist.pfx" });
				return expect(connection.connect()).to.be.rejected;
			});
		});
	});
});
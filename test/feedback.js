var rewire = require("rewire");
var Feedback = rewire("../lib/feedback");

var sinon = require("sinon");

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

	describe('constructor', function () {
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
	});

	describe('#initialize', function () {
		describe("with valid credentials", function() {
			var initialization;
			before(function() {
				initialization = Feedback({ pfx: "test/credentials/support/certIssuerKeyPassphrase.p12", passphrase: "apntest" }).initialize();
			});

			it("should be fulfilled", function () {
				return expect(initialization).to.be.fulfilled;
			});

			describe("resolution value", function() {
				it("contains the PFX data", function() {
					return expect(initialization.get("pfx")).to.eventually.have.length(3517);
				});

				it("includes passphrase", function() {
					return expect(initialization.get("passphrase")).to.eventually.equal("apntest");
				});
			});
		});
	});

	describe("connect", function() {
		var socketStub, removeStub;
		before(function() {
			socketStub = sinon.stub();
			removeStub = Feedback.__set__("createSocket", socketStub);
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

			var feedback = Feedback({ pfx: "test/credentials/support/certIssuerKey.p12", interval: 0 });
			sinon.spy(feedback, "initialize");
			feedback.connect().finally(function() {
				expect(feedback.initialize).to.have.been.calledOnce;
				done();
			});
		});

		describe("with valid credentials", function() {
			beforeEach(function() {
				socketStub.callsArg(2);
				socketStub.returns({ on: function() {}, once: function() {}, end: function() {} });
			});

			it("resolves", function() {
				var feedback = Feedback({ pfx: "test/credentials/support/certIssuerKeyPassphrase.p12", passphrase: "apntest", interval: 0 });
				return expect(feedback.connect()).to.be.fulfilled;
			});

			describe("the call to create socket", function() {
				var connect;
				beforeEach(function() {
					connect = Feedback({ 
						pfx: "test/credentials/support/certIssuerKey.p12",
						passphrase: "apntest",
						cert: "test/credentials/support/cert.pem",
						key: "test/credentials/support/key.pem",
						ca: [ "test/credentials/support/issuerCert.pem" ],
						interval: 0
					}).connect();
				});

				it("passes PFX data", function() {
					return connect.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.pfx).to.have.length(3767);
					});
				});

				it("passes the passphrase", function() {
					return connect.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.passphrase).to.equal("apntest");
					});
				});

				it("passes the cert", function() {
					return connect.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.cert).to.have.length(1355);
					});
				});

				it("passes the key", function() {
					return connect.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.key).to.have.length(1680);
					});
				});

				it("passes the ca certificates", function() {
					return connect.then(function() {
						var socketOptions = socketStub.args[0][1];
						expect(socketOptions.ca[0]).to.have.length(1285);
					});
				});
			});
		});

		describe("intialization failure", function() {
			it("is rejected", function() {
				var feedback = Feedback({ pfx: "a-non-existant-file-which-really-shouldnt-exist.pfx", interval: 0 });
				feedback.on("error", function() {});
				socketStub.callsArg(2);
		 		socketStub.returns({ on: function() {}, once: function() {}, end: function() {} });

				return expect(feedback.connect()).to.be.rejected;
			});
		});
	});
});
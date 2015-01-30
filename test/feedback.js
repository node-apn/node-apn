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
		it("should be fulfilled", function () {
			return expect(Feedback({ pfx: "test/support/initializeTest.pfx" })
					  .initialize()).to.be.fulfilled;
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
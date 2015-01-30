var rewire = require("rewire");
var Feedback = rewire("../lib/feedback");


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
});
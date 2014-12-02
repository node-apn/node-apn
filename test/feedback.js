var apn = require("../");
var fs = require("fs");

describe("Feedback", function() {
	describe('constructor', function () {
		var requestMethod, originalEnv;

		before(function() {
			requestMethod = apn.Feedback.prototype.request;
			apn.Feedback.prototype.request = function() { };

			originalEnv = process.env.NODE_ENV;
		});

		after(function() {
			apn.Feedback.prototype.request = requestMethod;
			process.env.NODE_ENV = originalEnv;
		});

		beforeEach(function() {
			process.env.NODE_ENV = "";
		});

		// Issue #50
		it("should use feedback.sandbox.push.apple.com as the default Feedback address", function () {
			expect(apn.Feedback().options.address).to.equal("feedback.sandbox.push.apple.com");
		});

		it("should use feedback.push.apple.com when NODE_ENV=production", function () {
			process.env.NODE_ENV = "production";
			expect(apn.Feedback().options.address).to.equal("feedback.push.apple.com");
		});

		it("should use feedback.push.apple.com when production:true", function () {
			expect(apn.Feedback({production:true}).options.address).to.equal("feedback.push.apple.com");
		});

		it("should give precedence to production flag over NODE_ENV=production", function () {
			process.env.NODE_ENV = "production";
			expect(apn.Feedback({ production: false }).options.address).to.equal("feedback.sandbox.push.apple.com");
		});

		it("should use a custom address when passed", function () {
			expect(apn.Feedback({address: "testaddress"}).options.address).to.equal("testaddress");
		});
	});

	describe('#initialize', function () {

		it("should be fulfilled", function () {
			return expect(apn.Feedback({ pfx: "test/support/initializeTest.pfx" })
					  .initialize()).to.be.fulfilled;
		});
	});
});
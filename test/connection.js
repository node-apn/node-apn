var apn = require("../");

describe("Connection", function() {
	describe('constructor', function () {

		// Issue #50
		it("should use gateway.sandbox.push.apple.com as the default connection address", function () {
			apn.Connection().options.address.should.equal("gateway.sandbox.push.apple.com");
		});

		it("should use gateway.push.apple.com when NODE_ENV=production", function () {
			var existingEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";
			apn.Connection().options.address.should.equal("gateway.push.apple.com");
			process.env.NODE_ENV = existingEnv;
		});

		it("should use gateway.push.apple.com when production:true", function () {
			apn.Connection({production:true}).options.address.should.equal("gateway.push.apple.com");
		});

		it("should use a custom address when passed", function () {
			apn.Connection({address: "testaddress"}).options.address.should.equal("testaddress");
		});
	});
});
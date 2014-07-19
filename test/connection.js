var apn = require("../");
var fs = require("fs");

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
			apn.Connection().options.address.should.equal("gateway.sandbox.push.apple.com");
		});

		it("should use gateway.push.apple.com when NODE_ENV=production", function () {
			process.env.NODE_ENV = "production";
			apn.Connection().options.address.should.equal("gateway.push.apple.com");
		});

		it("should give precedence to production flag over NODE_ENV=production", function () {
			process.env.NODE_ENV = "production";
			apn.Connection({ production: false }).options.address.should.equal("gateway.sandbox.push.apple.com");
		});

		it("should use gateway.push.apple.com when production:true", function () {
			apn.Connection({production:true}).options.address.should.equal("gateway.push.apple.com");
		});

		it("should use a custom address when passed", function () {
			apn.Connection({address: "testaddress"}).options.address.should.equal("testaddress");
		});
	});

	describe('#initialize', function () {
		it("should be fulfilled", function () {
			return apn.Connection({ pfx: "test/support/initializeTest.pfx" })
					  .initialize().should.be.fulfilled;
		});
	});
});
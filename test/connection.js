var rewire = require("rewire");
var Connection = rewire("../lib/connection");

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
		it("should be fulfilled", function () {
			return expect(Connection({ pfx: "test/support/initializeTest.pfx" })
					  .initialize()).to.be.fulfilled;
		});
	});
});
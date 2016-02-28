"use strict";

const sinon = require("sinon");

describe("Connection", function() {
	let fakes, Connection;

	beforeEach(() => {
		fakes = {
			credentials: {
				load: sinon.stub(),
				parse: sinon.stub(),
				validate: sinon.stub(),
			},
			EndpointManager: sinon.stub(),
		}

		Connection = require("../lib/connection")(fakes)
	})

	describe("constructor", function () {
		let originalEnv;

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
		it("should use api.sandbox.push.apple.com as the default connection address", function () {
			expect(Connection().options.address).to.equal("api.sandbox.push.apple.com");
		});

		it("should use api.push.apple.com when NODE_ENV=production", function () {
			process.env.NODE_ENV = "production";
			expect(Connection().options.address).to.equal("api.push.apple.com");
		});

		it("should give precedence to production flag over NODE_ENV=production", function () {
			process.env.NODE_ENV = "production";
			expect(Connection({ production: false }).options.address).to.equal("api.sandbox.push.apple.com");
		});

		it("should use api.push.apple.com when production:true", function () {
			expect(Connection({production:true}).options.address).to.equal("api.push.apple.com");
		});

		it("should use a custom address when passed", function () {
			expect(Connection({address: "testaddress"}).options.address).to.equal("testaddress");
		});

		describe("address is passed", function() {
			it("sets production to true when using production address", function() {
				expect(Connection({address: "api.push.apple.com"}).options.production).to.be.true;
			});

			it("sets production to false when using sandbox address", function() {
				process.env.NODE_ENV = "production";
				expect(Connection({address: "api.sandbox.push.apple.com"}).options.production).to.be.false;
			});
		});

		it("creates an EndpointManager", function() {
			var options = { address: "api.push.apple.com" }
			var connection = Connection(options);

			expect(fakes.EndpointManager).to.be.calledOnce;
			expect(fakes.EndpointManager).to.be.calledWithNew;
		});
	});


	describe("pushNotification", () => {});
});

function notificationDouble() {
	return {
		payload: { aps: { badge: 1 } },
		compile: function() { return JSON.stringify(this.payload); }
	};
}

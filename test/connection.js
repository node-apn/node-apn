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

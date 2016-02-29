"use strict";

const sinon = require("sinon");

describe("Connection", function() {
	let fakes, Connection;

	beforeEach(() => {
		fakes = {
			config: sinon.stub(),
			EndpointManager: sinon.stub(),
		}

		Connection = require("../lib/connection")(fakes)
	})

	describe("constructor", function () {

		context("called without `new`", () => {
			it("returns a new instance", () => {
				expect(Connection()).to.be.an.instanceof(Connection);
			});
		});

		it("prepares the configuration with passed options", () => {
			let options = { production: true };
			let connection = Connection(options);

			expect(fakes.config).to.be.calledWith(options);
		});

		describe("EndpointManager instance", function() {
			it("is created", () => {
				Connection();

				expect(fakes.EndpointManager).to.be.calledOnce;
				expect(fakes.EndpointManager).to.be.calledWithNew;
			});

			it("is passed the prepared configuration", () => {
				const returnSentinel = { "configKey": "configValue"};
				fakes.config.returns(returnSentinel);

				Connection({});
				expect(fakes.EndpointManager).to.be.calledWith(returnSentinel);
			});
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

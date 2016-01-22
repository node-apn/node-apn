"use strict";

let sinon = require("sinon");

describe("Endpoint Manager", () => {
	
	const fakes = {
    Endpoint: sinon.stub()
  }

	const EndpointManager = require("../../lib/protocol/endpointManager")(fakes);

	describe("get stream", () => {
		let manager;

		beforeEach(() => {
			fakes.Endpoint.reset();
			manager = new EndpointManager();
		});

		context("with no endpoints", () => {
			it("creates an endpoint connection", () => {
				manager.getStream();

				expect(fakes.Endpoint).to.be.calledOnce;
				expect(fakes.Endpoint).to.be.calledWithNew;
			});
		});

		context("with multiple endpoints", () => {
			it("reserves streams by round-robin")
			context("where next endpoint has no available slots", () => {
				it("skips to endpoint with availablility")
			})
			context("where no endpoints have available slots", () => {
				it("returns nil without reserving a stream")
			})
		});
	})

	context("when an endpoint wakes up", () => {
		describe("wakeup event", () => {
			it("is emitted when a connection has slots available")
		})
	})
})
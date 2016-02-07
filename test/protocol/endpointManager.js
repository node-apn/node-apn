"use strict";

const sinon = require("sinon");
const EventEmitter = require("events");

describe("Endpoint Manager", () => {
	let fakes, EndpointManager;

	beforeEach(() => {
		fakes = {
			Endpoint: sinon.stub()
		}

		fakes.Endpoint.returns(new EventEmitter);

		EndpointManager = require("../../lib/protocol/endpointManager")(fakes);
	});

	describe("get stream", () => {
		let manager;

		beforeEach(() => {
			fakes.Endpoint.reset();
			manager = new EndpointManager();
		});

		context("with no established endpoints", () => {
			it("creates an endpoint connection", () => {
				manager.getStream();

				expect(fakes.Endpoint).to.be.calledOnce;
				expect(fakes.Endpoint).to.be.calledWithNew;
			});

			context("with an endpoint already connecting", () => {
				xit("does not create a new Endpoint", () => {
					manager.getStream();

					fakes.Endpoint.reset();
					manager.getStream();

					expect(fakes.Endpoint).to.not.be.called;
				})
			});
		});


		context("with multiple endpoints", () => {
			it("reserves streams by round-robin")
			context("where next endpoint has no available slots", () => {
				it("skips to endpoint with availablility");
			});
			context("where no endpoints have available slots", () => {
				it("returns nil without reserving a stream");
			});
		});
	});

	describe("wakeup event", () => {
		context("when an endpoint connects", () => {

			it("is emitted", () => {
				const wakeupSpy = sinon.spy();
				const manager = new EndpointManager();

				manager.on("wakeup", wakeupSpy);
				manager.getStream();

				fakes.Endpoint.firstCall.returnValue.emit("connect");

				expect(wakeupSpy).to.be.calledOnce;
			});
		});

		context("when an endpoint wakes up", () => {
			it("is emitted when a connection has slots available")
		});
	});
});
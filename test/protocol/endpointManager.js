"use strict";

const sinon = require("sinon");
const EventEmitter = require("events");

describe("Endpoint Manager", () => {
  let fakes, EndpointManager;

  beforeEach(() => {
    fakes = {
      Endpoint: sinon.spy(function() {
        const endpoint = new EventEmitter();
        endpoint.destroy = sinon.spy();
        endpoint.createStream = sinon.stub().returns({"kind": "stream"});
        return endpoint;
      }),
    };

    EndpointManager = require("../../lib/protocol/endpointManager")(fakes);
  });

  describe("get stream", () => {
    let manager;

    beforeEach(() => {
      fakes.Endpoint.reset();
      manager = new EndpointManager({
        "connectionRetryLimit": 3,
        "maxConnections": 2,
      });
    });

    context("with no established endpoints", () => {
      it("creates an endpoint connection", () => {
        const fakeConfig = { "sentinel": "config", "maxConnections": 3 };

        manager = new EndpointManager(fakeConfig);
        manager.getStream();

        expect(fakes.Endpoint).to.be.calledOnce;
        expect(fakes.Endpoint).to.be.calledWith(fakeConfig);
        expect(fakes.Endpoint).to.be.calledWithNew;
      });

      it("returns null", () => {
        expect(manager.getStream()).to.be.null;
      });

      context("with an endpoint already connecting", () => {
        it("does not create a new Endpoint", () => {
          manager.getStream();

          fakes.Endpoint.reset();
          manager.getStream();

          expect(fakes.Endpoint).to.not.be.called;
        });

        it("returns null", () => {
          manager.getStream();

          expect(manager.getStream()).to.be.null;
        });
      });
    });

    context("with an established endpoint", () => {
      let endpoint;

      beforeEach(() => {
        manager.getStream();
        endpoint = fakes.Endpoint.returnValues[0];
        endpoint.emit("connect");
      });

      context("when there are available slots", () => {
        beforeEach(() => {
          endpoint.availableStreamSlots = 5;
        });

        it("calls createStream on the endpoint", () => {
          manager.getStream();

          expect(endpoint.createStream).to.have.been.calledOnce;
        });

        it("returns the endpoints created stream", () => {
          const sentinel = new Object;
          endpoint.createStream.returns(sentinel);

          expect(manager.getStream()).to.equal(sentinel);
        });
      });

      context("when there are no available stream slots", () => {
        beforeEach(() => {
          endpoint.availableStreamSlots = 0;
        });

        it("returns null", () => {
          expect(manager.getStream()).to.be.null;
        });

        context("when there are fewer than `maxConnections` connections", () => {
          it("creates an endpoint connection", () => {
            manager.getStream();

            expect(fakes.Endpoint).to.be.calledTwice;
          });
        });

        context("when there are already `maxConnections` connections", () => {
          it("does not attempt to create a further endpoint connection", () => {
            manager.getStream();
            const secondEndpoint = fakes.Endpoint.lastCall.returnValue
            secondEndpoint.availableStreamSlots = 0;
            secondEndpoint.emit("connect");

            manager.getStream();
            expect(fakes.Endpoint).to.be.calledTwice;
          });
        });
      });
    });

    context("with multiple endpoints", () => {
      it("reserves streams by round-robin");
      context("where next endpoint has no available slots", () => {
        it("skips to endpoint with availablility");
      });
      context("where no endpoints have available slots", () => {
        it("returns nil without reserving a stream");
      });
    });
  });

  describe("with one established connection", () => {

    context("when an error occurs", () => {
      beforeEach(() => {
        const manager = new EndpointManager({ "maxConnections": 3 });

        manager.getStream();
        fakes.Endpoint.lastCall.returnValue.emit("error", new Error("this should be handled"));
      });

      it("is destroyed", () => {
        const endpoint = fakes.Endpoint.firstCall.returnValue;
        expect(endpoint.destroy).to.be.called.once;
      });
    });

    context("when `connectionRetryLimit` consecutive endpoint errors occur", () => {
      it("emits an error", (done) => {
        const connectionRetryLimit = Math.floor(Math.random() * 5) % 5;
        const manager = new EndpointManager({
          "connectionRetryLimit": connectionRetryLimit,
          "maxConnections": 2,
        });

        for (let i = 0; i < connectionRetryLimit - 1; i++) {
          manager.getStream();
          fakes.Endpoint.lastCall.returnValue.emit("error", new Error("this should be handled"));
        }

        manager.on("error", err => {
          expect(err).to.match(/connection failed/i);
          done();
        });

        manager.getStream();
        fakes.Endpoint.lastCall.returnValue.emit("error", new Error("this should be handled"));
      });

      context("when a connection is successful between the errors", () => {
        it("does not emit an error", () => {
          const manager = new EndpointManager({
            "maxConnections": 2,
            "connectionRetryLimit": 2,
          });

          manager.getStream();
          fakes.Endpoint.lastCall.returnValue.emit("error", new Error("this should be handled"));

          manager.getStream();
          fakes.Endpoint.lastCall.returnValue.emit("connect");

          manager.getStream();
          fakes.Endpoint.lastCall.returnValue.emit("error", new Error("this should be handled"));
        });
      });
    });
  });

  describe("wakeup event", () => {

    context("when an endpoint wakes up", () => {
      let wakeupSpy, endpoint;

      beforeEach(() => {
        const manager = new EndpointManager({ "maxConnections": 3 });
        manager.getStream();

        endpoint = fakes.Endpoint.firstCall.returnValue;
        endpoint.emit("connect");
        wakeupSpy = sinon.spy();
        manager.on("wakeup", wakeupSpy);
      });

      context("with slots available", () => {
        it("is emitted", () => {
          endpoint.availableStreamSlots = 5;

          endpoint.emit("wakeup");

          expect(wakeupSpy).to.be.called;
        });
      });

      context("with no slots available", () => {
        it("doesn't emit", () => {
          endpoint.availableStreamSlots = 0;

          endpoint.emit("wakeup");

          expect(wakeupSpy).to.not.be.called;
        });
      });
    });
  });
});

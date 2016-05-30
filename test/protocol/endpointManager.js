"use strict";

const sinon = require("sinon");
const EventEmitter = require("events");

describe("Endpoint Manager", () => {
  let fakes, EndpointManager;

  beforeEach(() => {
    fakes = {
      Endpoint: sinon.stub(),
    };

    const endpoint = new EventEmitter();
    endpoint.createStream = sinon.stub().returns({"kind": "stream"});

    fakes.Endpoint.returns(endpoint);

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
        const fakeConfig = { "sentinel": "config"};

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

  describe("established connections", () => {
    let endpoint, manager;

    beforeEach(() => {
      manager = new EndpointManager();
      manager.getStream();

      endpoint = fakes.Endpoint.returnValues[0];
      endpoint.destroy = sinon.stub();
    });

    context("when an error occurs", () => {
      beforeEach(() => {
        endpoint.emit("error", new Error("this should be handled"));
      });

      it("is destroyed", () => {
        expect(endpoint.destroy).to.be.called.once;
      });
    });

    context("when 3 consecutive endpoint errors occur", () => {
      it("emits an error", (done) => {
        manager.on("error", err => {
          expect(err).to.match(/connection failed/i);
          done();
        });

        const firstEndpoint = endpoint;
        const secondEndpoint = new EventEmitter();
        secondEndpoint.destroy = sinon.stub();
        const thirdEndpoint = new EventEmitter();
        thirdEndpoint.destroy = sinon.stub();

        fakes.Endpoint.onSecondCall().returns(secondEndpoint);
        fakes.Endpoint.onThirdCall().returns(thirdEndpoint);

        firstEndpoint.emit("error", new Error("this should be handled"));

        manager.getStream();
        secondEndpoint.emit("error", new Error("this should be handled"));

        manager.getStream();
        thirdEndpoint.emit("error", new Error("this should be handled"));
      });
    });
  });

  describe("wakeup event", () => {

    context("when an endpoint wakes up", () => {
      let wakeupSpy, endpoint;

      beforeEach(() => {
        const manager = new EndpointManager();
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

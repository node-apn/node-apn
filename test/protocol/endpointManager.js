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
        manager.getStream();

        expect(fakes.Endpoint).to.be.calledOnce;
        expect(fakes.Endpoint).to.be.calledWithNew;
      });

      it("passes configuration through to endpoint initialiser", () => {
        const fakeConfig = { "sentinel": "config", "maxConnections": 3 };
        const manager = new EndpointManager(fakeConfig);

        manager.getStream();

        expect(fakes.Endpoint).to.be.calledWith(fakeConfig);
      });

      describe("created endpoint", () => {
        context("error occurs before connect", () => {
          beforeEach(() => {
            manager.getStream();
            fakes.Endpoint.firstCall.returnValue.emit("error", new Error("this should be handled"));
          });

          it("is destroyed", () => {
            const endpoint = fakes.Endpoint.firstCall.returnValue;
            expect(endpoint.destroy).to.be.called.once;
          });
        });
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
      let firstEndpoint, secondEndpoint;

      beforeEach(() => {
        firstEndpoint  = establishEndpoint(manager);
        secondEndpoint = establishEndpoint(manager);
      });

      it("reserves streams by round-robin", () => {
        firstEndpoint.availableStreamSlots = 1;
        secondEndpoint.availableStreamSlots = 1;

        expect(manager.getStream()).to.not.be.null;
        expect(manager.getStream()).to.not.be.null;
        expect(firstEndpoint.createStream).to.be.calledOnce;
        expect(secondEndpoint.createStream).to.be.calledOnce;
      });

      context("where next endpoint has no available slots", () => {
        it("skips to endpoint with availablility", () => {
          firstEndpoint.availableStreamSlots = 0;
          secondEndpoint.availableStreamSlots = 1;

          expect(manager.getStream()).to.not.be.null;
          expect(firstEndpoint.createStream).to.not.be.called;
          expect(secondEndpoint.createStream).to.be.calledOnce;
        });
      });

      context("when one endpoint has one available slot", () => {
        it("returns one stream", () => {
          firstEndpoint.availableStreamSlots = 0;

          secondEndpoint.availableStreamSlots = 1;
          expect(manager.getStream()).to.not.be.null;

          secondEndpoint.availableStreamSlots = 0;
          expect(manager.getStream()).to.be.null;

          expect(firstEndpoint.createStream).to.not.be.called;
          expect(secondEndpoint.createStream).to.be.calledOnce;
        });
      });

      context("where no endpoints have available slots", () => {
        it("returns null without reserving a stream", () => {
          firstEndpoint.availableStreamSlots = 0;
          secondEndpoint.availableStreamSlots = 0;

          expect(manager.getStream()).to.be.null;
          expect(firstEndpoint.createStream).to.not.be.called;
          expect(secondEndpoint.createStream).to.not.be.called;
        });
      });
    });
  });

  describe("with one established endpoint", () => {
    let endpoint, manager;

    beforeEach(() => {
      manager = new EndpointManager({ "maxConnections": 3 });
      manager.getStream();

      endpoint = fakes.Endpoint.firstCall.returnValue
      endpoint.availableStreamSlots = 5;
      endpoint.emit("connect");
    });

    context("when an error occurs", () => {
      beforeEach(() => {
        endpoint.emit("error", new Error("this should be handled"));
      });

      it("is destroyed", () => {
        expect(endpoint.destroy).to.be.called.once;
      });

    });

    context("when it ends", () => {
      beforeEach(() => {
        endpoint.emit("end");
      });

      it("is no longer used for streams", () => {
        manager.getStream();

        expect(endpoint.createStream).to.not.be.called;
      });
    });
  });

  describe("`connectionRetryLimit` option", () => {
    context("when the configured number of connections fail", () => {
      it("emits an error", (done) => {
        const connectionRetryLimit = (Math.floor(Math.random() * 3) % 3) + 2;
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
    });

    context("when a connection is successful between the failed connections", () => {
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

  function establishEndpoint(manager) {
    manager.getStream();
    let endpoint = fakes.Endpoint.lastCall.returnValue;
    endpoint.availableStreamSlots = 0;
    endpoint.emit("connect");
    return endpoint;
  }
});

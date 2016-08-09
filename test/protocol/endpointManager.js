"use strict";

const sinon = require("sinon");
const EventEmitter = require("events");

describe("Endpoint Manager", function () {
  let fakes, EndpointManager;

  beforeEach(function () {
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

  describe("get stream", function () {
    let manager;

    beforeEach(function () {
      fakes.Endpoint.reset();
      manager = new EndpointManager({
        "connectionRetryLimit": 3,
        "maxConnections": 2,
      });
    });

    context("with no established endpoints", function () {
      it("creates an endpoint connection", function () {
        manager.getStream();

        expect(fakes.Endpoint).to.be.calledOnce;
        expect(fakes.Endpoint).to.be.calledWithNew;
      });

      it("passes configuration through to endpoint initialiser", function () {
        const fakeConfig = { "sentinel": "config", "maxConnections": 3 };
        const manager = new EndpointManager(fakeConfig);

        manager.getStream();

        expect(fakes.Endpoint).to.be.calledWith(fakeConfig);
      });

      describe("created endpoint", function () {
        context("error occurs before connect", function () {
          beforeEach(function () {
            manager.getStream();
            fakes.Endpoint.firstCall.returnValue.emit("error", new Error("this should be handled"));
          });

          it("is destroyed", function () {
            const endpoint = fakes.Endpoint.firstCall.returnValue;
            expect(endpoint.destroy).to.be.called.once;
          });
        });
      });

      it("returns null", function () {
        expect(manager.getStream()).to.be.null;
      });

      context("with an endpoint already connecting", function () {
        it("does not create a new Endpoint", function () {
          manager.getStream();

          fakes.Endpoint.reset();
          manager.getStream();

          expect(fakes.Endpoint).to.not.be.called;
        });

        it("returns null", function () {
          manager.getStream();

          expect(manager.getStream()).to.be.null;
        });
      });
    });

    context("with an established endpoint", function () {
      let endpoint;

      beforeEach(function () {
        manager.getStream();
        endpoint = fakes.Endpoint.returnValues[0];
        endpoint.emit("connect");
      });

      context("when there are available slots", function () {
        beforeEach(function () {
          endpoint.availableStreamSlots = 5;
        });

        it("calls createStream on the endpoint", function () {
          manager.getStream();

          expect(endpoint.createStream).to.have.been.calledOnce;
        });

        it("returns the endpoints created stream", function () {
          const sentinel = new Object;
          endpoint.createStream.returns(sentinel);

          expect(manager.getStream()).to.equal(sentinel);
        });
      });

      context("when there are no available stream slots", function () {
        beforeEach(function () {
          endpoint.availableStreamSlots = 0;
        });

        it("returns null", function () {
          expect(manager.getStream()).to.be.null;
        });

        context("when there are fewer than `maxConnections` connections", function () {
          it("creates an endpoint connection", function () {
            manager.getStream();

            expect(fakes.Endpoint).to.be.calledTwice;
          });
        });

        context("when there are already `maxConnections` connections", function () {
          it("does not attempt to create a further endpoint connection", function () {
            manager.getStream();
            const secondEndpoint = fakes.Endpoint.lastCall.returnValue;
            secondEndpoint.availableStreamSlots = 0;
            secondEndpoint.emit("connect");

            manager.getStream();
            expect(fakes.Endpoint).to.be.calledTwice;
          });
        });
      });
    });

    context("with multiple endpoints", function () {
      let firstEndpoint, secondEndpoint;

      beforeEach(function () {
        firstEndpoint  = establishEndpoint(manager);
        secondEndpoint = establishEndpoint(manager);
      });

      it("reserves streams by round-robin", function () {
        firstEndpoint.availableStreamSlots = 1;
        secondEndpoint.availableStreamSlots = 1;

        expect(manager.getStream()).to.not.be.null;
        expect(manager.getStream()).to.not.be.null;
        expect(firstEndpoint.createStream).to.be.calledOnce;
        expect(secondEndpoint.createStream).to.be.calledOnce;
      });

      context("where next endpoint has no available slots", function () {
        it("skips to endpoint with availablility", function () {
          firstEndpoint.availableStreamSlots = 0;
          secondEndpoint.availableStreamSlots = 1;

          expect(manager.getStream()).to.not.be.null;
          expect(firstEndpoint.createStream).to.not.be.called;
          expect(secondEndpoint.createStream).to.be.calledOnce;
        });
      });

      context("when one endpoint has one available slot", function () {
        it("returns one stream", function () {
          firstEndpoint.availableStreamSlots = 0;

          secondEndpoint.availableStreamSlots = 1;
          expect(manager.getStream()).to.not.be.null;

          secondEndpoint.availableStreamSlots = 0;
          expect(manager.getStream()).to.be.null;

          expect(firstEndpoint.createStream).to.not.be.called;
          expect(secondEndpoint.createStream).to.be.calledOnce;
        });
      });

      context("where no endpoints have available slots", function () {
        it("returns null without reserving a stream", function () {
          firstEndpoint.availableStreamSlots = 0;
          secondEndpoint.availableStreamSlots = 0;

          expect(manager.getStream()).to.be.null;
          expect(firstEndpoint.createStream).to.not.be.called;
          expect(secondEndpoint.createStream).to.not.be.called;
        });
      });
    });
  });

  describe("with one established endpoint", function () {
    let endpoint, manager;

    beforeEach(function () {
      manager = new EndpointManager({ "maxConnections": 3 });
      manager.getStream();

      endpoint = fakes.Endpoint.firstCall.returnValue;
      endpoint.availableStreamSlots = 5;
      endpoint.emit("connect");
    });

    context("when an error occurs", function () {
      beforeEach(function () {
        endpoint.emit("error", new Error("this should be handled"));
      });

      it("is destroyed", function () {
        expect(endpoint.destroy).to.be.called.once;
      });

      it("is no longer used for streams", function () {
        manager.getStream();

        expect(endpoint.createStream).to.not.be.called;
      });

      it("does not affect a 'connecting' endpoint", function () {
        fakes.Endpoint.reset();
        manager = new EndpointManager({ "maxConnections": 3 });
        manager.getStream();

        endpoint = fakes.Endpoint.firstCall.returnValue
        endpoint.emit("connect");

        // Trigger creation of a second endpoint
        manager.getStream();
        let connectingEndpoint = fakes.Endpoint.secondCall.returnValue;
        expect(connectingEndpoint).to.not.be.null;
        expect(fakes.Endpoint).to.be.calledTwice;

        // Error-out the first endpoint
        endpoint.emit("error", new Error("this should be handled"));

        // Ensure a third endpoint isn't created as the second is still connecting
        manager.getStream();

        expect(fakes.Endpoint).to.be.calledTwice;
      });
    });

    context("when it ends", function () {
      beforeEach(function () {
        endpoint.emit("end");
      });

      it("is no longer used for streams", function () {
        manager.getStream();

        expect(endpoint.createStream).to.not.be.called;
      });
    });
  });

  describe("`connectionRetryLimit` option", function () {
    context("when the configured number of connections fail", function () {
      it("emits an error", function(done) {
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

    context("when a connection is successful between the failed connections", function () {
      it("does not emit an error", function () {
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

    context("when an error happens on a connected endpoint", function () {
      it("does not contribute to reaching the limit", function () {
        const manager = new EndpointManager({
          "maxConnections": 2,
          "connectionRetryLimit": 2,
        });

        manager.getStream();
        fakes.Endpoint.lastCall.returnValue.emit("connect");
        fakes.Endpoint.lastCall.returnValue.emit("error", new Error("this should be handled"));

        manager.getStream();
        fakes.Endpoint.lastCall.returnValue.emit("error", new Error("this should be handled"));
      });
    });
  });

  describe("wakeup event", function () {

    context("when an endpoint wakes up", function () {
      let wakeupSpy, endpoint;

      beforeEach(function () {
        const manager = new EndpointManager({ "maxConnections": 3 });
        manager.getStream();

        endpoint = fakes.Endpoint.firstCall.returnValue;
        endpoint.emit("connect");
        wakeupSpy = sinon.spy();
        manager.on("wakeup", wakeupSpy);
      });

      context("with slots available", function () {
        it("is emitted", function () {
          endpoint.availableStreamSlots = 5;

          endpoint.emit("wakeup");

          expect(wakeupSpy).to.be.called;
        });
      });

      context("with no slots available", function () {
        it("doesn't emit", function () {
          endpoint.availableStreamSlots = 0;

          endpoint.emit("wakeup");

          expect(wakeupSpy).to.not.be.called;
        });
      });
    });
  });

  describe("shutdown", function () {

    it("calls `close` on all established endpoints", function () {
      const manager = new EndpointManager({ maxConnections: 3 });

      let firstEndpoint  = establishEndpoint(manager);
      let secondEndpoint = establishEndpoint(manager);

      firstEndpoint.close = sinon.stub();
      secondEndpoint.close = sinon.stub();

      manager.shutdown();

      expect(firstEndpoint.close).to.have.been.calledOnce;
      expect(firstEndpoint.close).to.have.been.calledOnce;
    });

    it("aborts pending endpoint connects", function () {
      const manager = new EndpointManager({ maxConnections: 3 });

      const connectingEndpoint = establishEndpoint(manager, true);

      connectingEndpoint.close = sinon.stub();

      manager.shutdown();

      expect(connectingEndpoint.close).to.have.been.calledOnce;
    });
  });

  function establishEndpoint(manager, skipConnect) {
    manager.getStream();
    let endpoint = fakes.Endpoint.lastCall.returnValue;
    endpoint.availableStreamSlots = 0;

    if (!skipConnect) {
      endpoint.emit("connect");
    }
    return endpoint;
  }
});

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
            expect(endpoint.destroy).to.be.calledOnce;
          });

          it("emits wakeup", function (){
            let endpoint = establishEndpoint(manager, true);

            let wakeupSpy = sinon.spy();
            manager.on("wakeup", wakeupSpy);

            endpoint.emit("error", new Error("this should be handled"));
            expect(wakeupSpy).to.be.calledOnce;
          });

          it("allows immediate reconnect in the wakeup event", function (done) {
            let endpoint = establishEndpoint(manager, true);

            manager.on("wakeup", function() {
              let endpoint = establishEndpoint(manager, true);

              expect(endpoint).to.not.be.null;

              done();
            });

            endpoint.emit("error", new Error("this should be handled"));
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
        endpoint = establishEndpoint(manager);
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
            establishEndpoint(manager);

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

  context("with one established endpoint", function () {
    let endpoint, manager;

    beforeEach(function () {
      manager = new EndpointManager({ "maxConnections": 3 });
      endpoint = establishEndpoint(manager);
      endpoint.availableStreamSlots = 5;
    });

    context("when an error occurs", function () {
      let wakeupSpy;

      beforeEach(function () {
        wakeupSpy = sinon.spy();
        manager.on("wakeup", wakeupSpy);
        
        endpoint.emit("error", new Error("this should be handled"));
      });

      it("is destroyed", function () {
        expect(endpoint.destroy).to.be.calledOnce;
      });

      it("is no longer used for streams", function () {
        manager.getStream();

        expect(endpoint.createStream).to.not.be.called;
      });

      it("emits an wakeup event", function (){
        expect(wakeupSpy).to.be.calledOnce;
      });

      it("does not affect a 'connecting' endpoint", function () {
        fakes.Endpoint.reset();
        manager = new EndpointManager({ "maxConnections": 3 });
        endpoint = establishEndpoint(manager);

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

      it("triggers a wakeup", function (done) {
        fakes.Endpoint.reset();
        manager = new EndpointManager({ "maxConnections": 3 });
        endpoint = establishEndpoint(manager);

        manager.on("wakeup", function() {
          done();
        });

        endpoint.emit("end");
      });
    });
  });

  describe("`connectionRetryLimit` option", function () {
    let connectionRetryLimit, manager;

    beforeEach(function () {
      connectionRetryLimit = (Math.floor(Math.random() * 3) % 3) + 2;
      manager = new EndpointManager({
        "connectionRetryLimit": connectionRetryLimit,
        "maxConnections": 2,
      });
    });

    context("with no established endpoints", function () {
      context("when the configured number of connections fail", function () {
        let error;

        beforeEach(function () {
          for (let i = 0; i < connectionRetryLimit - 1; i++) {
            manager.getStream();
            fakes.Endpoint.lastCall.returnValue.emit("error", new Error("this should be handled"));
          }

          error = null;
          // Only allow an error after the limit is reached
          manager.on("error", err => {
            error = err;
          });

          manager.getStream();
          fakes.Endpoint.lastCall.returnValue.emit("error", new Error("this should be handled"));
        });

        it("emits an error", function() {
          expect(error).to.match(/endpoint error/i);
          expect(error.cause()).to.match(/this should be handled/i);
        });

        it("resets the failure count", function () {
          expect(manager._connectionFailures).to.equal(0);
        });
      });
    });

    context("with an established endpoint", function() {
      let establishedEndpoint;

      beforeEach(function () {
        establishedEndpoint = establishEndpoint(manager);
      });

      context("when the configured number of connections fail", function () {
        it("does not emit an error", function() {
          manager.on("error", function() {
            throw err;
          });

          for (let i = 0; i < connectionRetryLimit; i++) {
            manager.getStream();
            fakes.Endpoint.lastCall.returnValue.emit("error", new Error("this should be handled"));
          }
        });
      });

      context("when the endpoint ends after some failed connections", function () {
        beforeEach(function () {
          for (let i = 0; i < connectionRetryLimit - 1; i++) {
            manager.getStream();
            fakes.Endpoint.lastCall.returnValue.emit("error", new Error("this should be handled"));
          }
          establishedEndpoint.emit("end");
        });

        context("when the configured number of connections fail", function () {
          let error;

          beforeEach(function () {
            for (let i = 0; i < connectionRetryLimit - 1; i++) {
              manager.getStream();
              fakes.Endpoint.lastCall.returnValue.emit("error", new Error("this should be handled"));
            }

            error = null;
            // Only allow an error after the limit is reached
            manager.on("error", err => {
              error = err;
            });

            manager.getStream();
              fakes.Endpoint.lastCall.returnValue.emit("error", new Error("this should be handled"));
          });

          it("emits an error", function() {
            expect(error).to.match(/endpoint error/i);
            expect(error.cause()).to.match(/this should be handled/i);
          });
        });
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

        // Should not trigger an unhandled 'error' event
      });
    });

    context("when an error happens on a connected endpoint", function () {
      it("does not contribute to reaching the limit", function (done) {
        const manager = new EndpointManager({
          "maxConnections": 2,
          "connectionRetryLimit": 2,
        });

        manager.getStream();
        fakes.Endpoint.lastCall.returnValue.emit("connect");
        fakes.Endpoint.lastCall.returnValue.emit("error", new Error("this should be handled"));

        manager.getStream();
        fakes.Endpoint.lastCall.returnValue.emit("error", new Error("this should be handled"));

        manager.on("error", err => {
          expect(err).to.match(/endpoint error/i);
          expect(err.cause()).to.match(/this should be emitted/i);
          done();
        });

        manager.getStream();
        fakes.Endpoint.lastCall.returnValue.emit("error", new Error("this should be emitted"));

        expect(fakes.Endpoint).to.be.calledThrice;
      });
    });
  });

  describe("wakeup event", function () {

    context("when an endpoint wakes up", function () {
      let wakeupSpy, endpoint;

      beforeEach(function () {
        const manager = new EndpointManager({ "maxConnections": 3 });
        endpoint = establishEndpoint(manager);

        wakeupSpy = sinon.spy();
        manager.on("wakeup", wakeupSpy);
      });
      
      it("is emitted", function () {
        endpoint.availableStreamSlots = 5;

        endpoint.emit("wakeup");

        expect(wakeupSpy).to.be.called;
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
    let callCount = fakes.Endpoint.callCount;
    manager.getStream();

    if(fakes.Endpoint.callCount !== callCount + 1) {
      return null;
    }

    let endpoint = fakes.Endpoint.lastCall.returnValue;
    endpoint.availableStreamSlots = 0;

    if (!skipConnect) {
      endpoint.emit("connect");
    }
    return endpoint;
  }
});

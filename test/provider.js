"use strict";

const sinon = require("sinon");
const EventEmitter = require("events");

describe("Provider", function() {
  let fakes, Provider;

  beforeEach(function () {
    fakes = {
      Client: sinon.stub(),
      client: new EventEmitter(),
    };

    fakes.Client.returns(fakes.client);
    fakes.client.write = sinon.stub();
    fakes.client.shutdown = sinon.stub();

    Provider = require("../lib/provider")(fakes);
  });

  describe("constructor", function () {

    context("called without `new`", function () {
      it("returns a new instance", function () {
        expect(Provider()).to.be.an.instanceof(Provider);
      });
    });

    describe("Client instance", function() {
      it("is created", function () {
        Provider();

        expect(fakes.Client).to.be.calledOnce;
        expect(fakes.Client).to.be.calledWithNew;
      });

      it("is passed the options", function () {
        const options = { "configKey": "configValue"};

        Provider(options);
        expect(fakes.Client).to.be.calledWith(options);
      });
    });
  });

  describe("send", function () {

    describe("single notification behaviour", function () {
      let provider;

      context("transmission succeeds", function () {
        beforeEach( function () {
          provider = new Provider( { address: "testapi" } );

          fakes.client.write.onCall(0).returns(Promise.resolve({ device: "abcd1234" }));
        });

        it("invokes the writer with correct `this`", function () {
          return provider.send(notificationDouble(), "abcd1234")
            .then(function () {
              expect(fakes.client.write).to.be.calledOn(fakes.client);
            });
        });

        it("writes the notification to the client once", function () {
          return provider.send(notificationDouble(), "abcd1234")
            .then(function () {
              const notification = notificationDouble();
              const builtNotification = {
                headers: notification.headers(),
                body: notification.compile(),
              };
              expect(fakes.client.write).to.be.calledOnce;
              expect(fakes.client.write).to.be.calledWith(builtNotification, "abcd1234");
            });
        });

        it("does not pass the array index to writer", function () {
          return provider.send(notificationDouble(), "abcd1234")
            .then(function () {
              expect(fakes.client.write.firstCall.args[2]).to.be.undefined;
            });
        });

        it("resolves with the device token in the sent array", function () {
          return expect(provider.send(notificationDouble(), "abcd1234"))
            .to.become({ sent: [{"device": "abcd1234"}], failed: []});
        });
      });

      context("error occurs", function () {
        let promise;

        beforeEach(function () {
          const provider = new Provider( { address: "testapi" } );

          fakes.client.write.onCall(0).returns(Promise.resolve({ device: "abcd1234", status: "400", response: { reason: "BadDeviceToken" }}));
          promise = provider.send(notificationDouble(), "abcd1234");
        });

        it("resolves with the device token, status code and response in the failed array", function () {
          return expect(promise).to.eventually.deep.equal({ sent: [], failed: [{"device": "abcd1234", "status": "400", "response": { "reason" : "BadDeviceToken" }}]});
        });
      });
    });

    context("when multiple tokens are passed", function () {

      beforeEach(function () {
          fakes.resolutions = [
            { device: "abcd1234" },
            { device: "adfe5969", status: "400", response: { reason: "MissingTopic" }},
            { device: "abcd1335", status: "410", response: { reason: "BadDeviceToken", timestamp: 123456789 }},
            { device: "bcfe4433" },
            { device: "aabbc788", status: "413", response: { reason: "PayloadTooLarge" }},
            { device: "fbcde238", error: new Error("connection failed") },
          ];
      });

      context("streams are always returned", function () {
        let promise;

        beforeEach( function () {
          const provider = new Provider( { address: "testapi" } );

          for(let i=0; i < fakes.resolutions.length; i++) {
            fakes.client.write.onCall(i).returns(Promise.resolve(fakes.resolutions[i])); 
          }

          promise = provider.send(notificationDouble(), fakes.resolutions.map( res => res.device ));

          return promise;
        });

        it("resolves with the sent notifications", function () {
          return promise.then( (response) => {
            expect(response.sent).to.deep.equal([{device: "abcd1234"}, {device: "bcfe4433"}]);
          });
        });

        it("resolves with the device token, status code and response or error of the unsent notifications", function () {
          return promise.then( (response) => {
            expect(response.failed[0]).to.deep.equal({ device: "adfe5969", status: "400", response: { reason: "MissingTopic" }});
            expect(response.failed[1]).to.deep.equal({ device: "abcd1335", status: "410", response: { reason: "BadDeviceToken", timestamp: 123456789 }});
            expect(response.failed[2]).to.deep.equal({ device: "aabbc788", status: "413", response: { reason: "PayloadTooLarge" }});
            expect(response.failed[3]).to.have.property("device", "fbcde238");
            expect(response.failed[3]).to.have.nested.property("error.message", "connection failed");
          });
        });
      });
    });
  });

  describe("shutdown", function () {
    it("invokes shutdown on the client", function () { 
      let provider = new Provider({});
      provider.shutdown();

      expect(fakes.client.shutdown).to.be.calledOnce;
    });
  });
});

function notificationDouble() {
  return {
    headers: sinon.stub().returns({}),
    payload: { aps: { badge: 1 } },
    compile: function() { return JSON.stringify(this.payload); }
  };
}

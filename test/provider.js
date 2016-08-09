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

        it("invokes the writer withe correct `this`", function () {
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

    context("when 5 tokens are passed", function () {

      beforeEach(function () {
          fakes.resolutions = [
            Promise.resolve({ device: "abcd1234" }),
            Promise.resolve({ device: "adfe5969", status: "400", response: { reason: "MissingTopic" }}),
            Promise.resolve({ device: "abcd1335", status: "410", response: { reason: "BadDeviceToken", timestamp: 123456789 }}),
            Promise.resolve({ device: "bcfe4433" }),
            Promise.resolve({ device: "aabbc788", status: "413", response: { reason: "PayloadTooLarge" }}),
          ];
      });

      context("streams are always returned", function () {
        let promise;

        beforeEach( function () {
          const provider = new Provider( { address: "testapi" } );

          fakes.client.write.onCall(0).returns(fakes.resolutions[0]);
          fakes.client.write.onCall(1).returns(fakes.resolutions[1]);
          fakes.client.write.onCall(2).returns(fakes.resolutions[2]);
          fakes.client.write.onCall(3).returns(fakes.resolutions[3]);
          fakes.client.write.onCall(4).returns(fakes.resolutions[4]);

          promise = provider.send(notificationDouble(), ["abcd1234", "adfe5969", "abcd1335", "bcfe4433", "aabbc788"]);

          return promise;
        });

        it("resolves with the sent notifications", function () {
          return expect(promise.get("sent")).to.eventually.deep.equal([{device: "abcd1234"}, {device: "bcfe4433"}]);
        });

        it("resolves with the device token, status code and response of the unsent notifications", function () {
          return expect(promise.get("failed")).to.eventually.deep.equal([
            { device: "adfe5969", status: "400", response: { reason: "MissingTopic" }},
            { device: "abcd1335", status: "410", response: { reason: "BadDeviceToken", timestamp: 123456789 }},
            { device: "aabbc788", status: "413", response: { reason: "PayloadTooLarge" }},
          ]);
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

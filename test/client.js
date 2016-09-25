"use strict";

const sinon = require("sinon");
const stream = require("stream");
const EventEmitter = require("events");

describe("Client", function () {
  let fakes, Client;

  beforeEach(function () {
    fakes = {
      config: sinon.stub(),
      EndpointManager: sinon.stub(),
      endpointManager: new EventEmitter(),
    };

    fakes.EndpointManager.returns(fakes.endpointManager);
    fakes.endpointManager.shutdown = sinon.stub();

    Client = require("../lib/client")(fakes);
  });

  describe("constructor", function () {
    it("prepares the configuration with passed options", function () {
      let options = { production: true };
      let client = new Client(options);

      expect(fakes.config).to.be.calledWith(options);
    });

    describe("EndpointManager instance", function() {
      it("is created", function () {
        let client = new Client();

        expect(fakes.EndpointManager).to.be.calledOnce;
        expect(fakes.EndpointManager).to.be.calledWithNew;
      });

      it("is passed the prepared configuration", function () {
        const returnSentinel = { "configKey": "configValue"};
        fakes.config.returns(returnSentinel);

        let client = new Client({});
        expect(fakes.EndpointManager).to.be.calledWith(returnSentinel);
      });
    });
  });

  describe("write", function () {
    beforeEach(function () {
      fakes.config.returnsArg(0);
      fakes.endpointManager.getStream = sinon.stub();

      fakes.EndpointManager.returns(fakes.endpointManager);
    });

    context("a stream is available", function () {
      let client;

      context("transmission succeeds", function () {
        beforeEach( function () {
          client = new Client( { address: "testapi" } );

          fakes.stream = new FakeStream("abcd1234", "200");
          fakes.endpointManager.getStream.onCall(0).returns(fakes.stream);
        });

        it("attempts to acquire one stream", function () {
          return client.write(builtNotification(), "abcd1234")
            .then(function () {
              expect(fakes.endpointManager.getStream).to.be.calledOnce;
            });
        });

        describe("headers", function () {

          it("sends the required HTTP/2 headers", function () {
            return client.write(builtNotification(), "abcd1234")
              .then(function () {
                expect(fakes.stream.headers).to.be.calledWithMatch( {
                  ":scheme": "https",
                  ":method": "POST",
                  ":authority": "testapi",
                  ":path": "/3/device/abcd1234",
                });
              });
          });

          it("does not include apns headers when not required", function () {
            return client.write(builtNotification(), "abcd1234")
              .then(function () {
                ["apns-id", "apns-priority", "apns-expiration", "apns-topic"].forEach( header => {
                  expect(fakes.stream.headers).to.not.be.calledWithMatch(sinon.match.has(header));
                });
              });
          });

          it("sends the notification-specific apns headers when specified", function () {
            let notification = builtNotification();

            notification.headers = {
              "apns-id": "123e4567-e89b-12d3-a456-42665544000",
              "apns-priority": 5,
              "apns-expiration": 123,
              "apns-topic": "io.apn.node",
            };

            return client.write(notification, "abcd1234")
              .then(function () {
                expect(fakes.stream.headers).to.be.calledWithMatch( {
                  "apns-id": "123e4567-e89b-12d3-a456-42665544000",
                  "apns-priority": 5,
                  "apns-expiration": 123,
                  "apns-topic": "io.apn.node",
                });
              });
          });

          context("when token authentication is enabled", function () {
            beforeEach(function () {
              fakes.token = {
                generation: 0,
                current: "fake-token",
                regenerate: sinon.stub(),
              };

              client = new Client( { address: "testapi", token: fakes.token } );

              fakes.stream = new FakeStream("abcd1234", "200");
              fakes.endpointManager.getStream.onCall(0).returns(fakes.stream);
            });

            it("sends the bearer token", function () {
              let notification = builtNotification();

              return client.write(notification, "abcd1234").then(function () {
                expect(fakes.stream.headers).to.be.calledWithMatch({
                  authorization: "bearer fake-token",
                });
              });
            });
          });

          context("when token authentication is disabled", function () {
            beforeEach(function () {
              client = new Client( { address: "testapi" } );

              fakes.stream = new FakeStream("abcd1234", "200");
              fakes.endpointManager.getStream.onCall(0).returns(fakes.stream);
            });

            it("does not set an authorization header", function () {
              let notification = builtNotification();

              return client.write(notification, "abcd1234").then(function () {
                expect(fakes.stream.headers.firstCall.args[0]).to.not.have.property("authorization");
              })
            });
          })
        });

        it("writes the notification data to the pipe", function () {
          const notification = builtNotification();
          return client.write(notification, "abcd1234")
            .then(function () {
              expect(fakes.stream._transform).to.be.calledWithMatch(actual => actual.equals(Buffer(notification.body)));
            });
        });

        it("ends the stream", function () {
          sinon.spy(fakes.stream, "end");
          return client.write(builtNotification(), "abcd1234")
            .then(function () {
              expect(fakes.stream.end).to.be.calledOnce;
            });
        });

        it("resolves with the device token", function () {
          return expect(client.write(builtNotification(), "abcd1234"))
            .to.become({ device: "abcd1234" });
        });
      });

      context("error occurs", function () {
        let promise;

        context("general case", function () {
          beforeEach(function () {
            const client = new Client( { address: "testapi" } );

            fakes.stream = new FakeStream("abcd1234", "400", { "reason" : "BadDeviceToken" });
            fakes.endpointManager.getStream.onCall(0).returns(fakes.stream);

            promise = client.write(builtNotification(), "abcd1234");
          });

          it("resolves with the device token, status code and response", function () {
            return expect(promise).to.eventually.deep.equal({ status: "400", device: "abcd1234", response: { reason: "BadDeviceToken" }});
          });
        })

        context("ExpiredProviderToken", function () {
          beforeEach(function () {
            let tokenGenerator = sinon.stub().returns("fake-token");
            const client = new Client( { address: "testapi", token: tokenGenerator });
          })
        });
      });

      context("stream ends without completing request", function () {
        let promise;

        beforeEach(function () {
          const client = new Client( { address: "testapi" } );
          fakes.stream = new stream.Transform({
            transform: function(chunk, encoding, callback) {}
          });
          fakes.stream.headers = sinon.stub();

          fakes.endpointManager.getStream.onCall(0).returns(fakes.stream);

          promise = client.write(builtNotification(), "abcd1234");

          fakes.stream.push(null);
        });

        it("resolves with an object containing the device token", function () {
          return expect(promise).to.eventually.have.property("device", "abcd1234");
        });

        it("resolves with an object containing an error", function () {
          return promise.then( (response) => {
            expect(response).to.have.property("error");
            expect(response.error).to.be.an.instanceOf(Error);
            expect(response.error).to.match(/stream ended unexpectedly/);
          });
        });
      });

      context("stream is unprocessed", function () {
        let promise;

        beforeEach(function () {
          const client = new Client( { address: "testapi" } );
          fakes.stream = new stream.Transform({
            transform: function(chunk, encoding, callback) {}
          });
          fakes.stream.headers = sinon.stub();

          fakes.secondStream = FakeStream("abcd1234", "200");

          fakes.endpointManager.getStream.onCall(0).returns(fakes.stream);
          fakes.endpointManager.getStream.onCall(1).returns(fakes.secondStream);

          promise = client.write(builtNotification(), "abcd1234");
          
          setImmediate(() => {
            fakes.stream.emit("unprocessed");
          });
        });

        it("attempts to resend on a new stream", function (done) {
          setImmediate(() => {
            expect(fakes.endpointManager.getStream).to.be.calledTwice;
            done();
          });
        });

        it("fulfills the promise", function () {
          return expect(promise).to.eventually.deep.equal({ device: "abcd1234"  });
        });
      });

      context("stream error occurs", function () {
        let promise;

        beforeEach(function () {
          const client = new Client( { address: "testapi" } );
          fakes.stream = new stream.Transform({
            transform: function(chunk, encoding, callback) {}
          });
          fakes.stream.headers = sinon.stub();

          fakes.endpointManager.getStream.onCall(0).returns(fakes.stream);

          promise = client.write(builtNotification(), "abcd1234");
        });

        context("passing an Error", function () {
          beforeEach(function () {
            fakes.stream.emit("error", new Error("stream error"));
          });

          it("resolves with an object containing the device token", function () {
            return expect(promise).to.eventually.have.property("device", "abcd1234");
          });

          it("resolves with an object containing a wrapped error", function () {
            return promise.then( (response) => {
              expect(response.error).to.be.an.instanceOf(Error);
              expect(response.error).to.match(/apn write failed/);
              expect(response.error.cause()).to.be.an.instanceOf(Error).and.match(/stream error/);
            });
          });
        });

        context("passing a string", function () {
          it("resolves with the device token and an error", function () {
            fakes.stream.emit("error", "stream error");
            return promise.then( (response) => {
                expect(response).to.have.property("device", "abcd1234");
                expect(response.error).to.to.be.an.instanceOf(Error);
                expect(response.error).to.match(/apn write failed/);
                expect(response.error).to.match(/stream error/);
            });
          });
        });
      });
    });

    context("no new stream is returned but the endpoint later wakes up", function () {
      let notification, promise;

      beforeEach( function () {
        const client = new Client( { address: "testapi" } );

        fakes.stream = new FakeStream("abcd1234", "200");
        fakes.endpointManager.getStream.onCall(0).returns(null);
        fakes.endpointManager.getStream.onCall(1).returns(fakes.stream);

        notification = builtNotification();
        promise = client.write(notification, "abcd1234");

        expect(fakes.stream.headers).to.not.be.called;

        fakes.endpointManager.emit("wakeup");

        return promise;
      });

      it("sends the required headers to the newly available stream", function () {
        expect(fakes.stream.headers).to.be.calledWithMatch( {
          ":scheme": "https",
          ":method": "POST",
          ":authority": "testapi",
          ":path": "/3/device/abcd1234",
        });
      });

      it("writes the notification data to the pipe", function () {
        expect(fakes.stream._transform).to.be.calledWithMatch(actual => actual.equals(Buffer(notification.body)));
      });
    });

    context("when 5 successive notifications are sent", function () {

      beforeEach(function () {
          fakes.streams = [
            new FakeStream("abcd1234", "200"),
            new FakeStream("adfe5969", "400", { reason: "MissingTopic" }),
            new FakeStream("abcd1335", "410", { reason: "BadDeviceToken", timestamp: 123456789 }),
            new FakeStream("bcfe4433", "200"),
            new FakeStream("aabbc788", "413", { reason: "PayloadTooLarge" }),
          ];
      });

      context("streams are always returned", function () {
        let promises;

        beforeEach( function () {
          const client = new Client( { address: "testapi" } );

          fakes.endpointManager.getStream.onCall(0).returns(fakes.streams[0]);
          fakes.endpointManager.getStream.onCall(1).returns(fakes.streams[1]);
          fakes.endpointManager.getStream.onCall(2).returns(fakes.streams[2]);
          fakes.endpointManager.getStream.onCall(3).returns(fakes.streams[3]);
          fakes.endpointManager.getStream.onCall(4).returns(fakes.streams[4]);

          promises = Promise.all([
            client.write(builtNotification(), "abcd1234"),
            client.write(builtNotification(), "adfe5969"),
            client.write(builtNotification(), "abcd1335"),
            client.write(builtNotification(), "bcfe4433"),
            client.write(builtNotification(), "aabbc788"),
          ]);

          return promises;
        });

        it("sends the required headers for each stream", function () {
          expect(fakes.streams[0].headers).to.be.calledWithMatch( { ":path": "/3/device/abcd1234" } );
          expect(fakes.streams[1].headers).to.be.calledWithMatch( { ":path": "/3/device/adfe5969" } );
          expect(fakes.streams[2].headers).to.be.calledWithMatch( { ":path": "/3/device/abcd1335" } );
          expect(fakes.streams[3].headers).to.be.calledWithMatch( { ":path": "/3/device/bcfe4433" } );
          expect(fakes.streams[4].headers).to.be.calledWithMatch( { ":path": "/3/device/aabbc788" } );
        });

        it("writes the notification data for each stream", function () {
          fakes.streams.forEach( stream => {
            expect(stream._transform).to.be.calledWithMatch(actual => actual.equals(Buffer(builtNotification().body)));
          });
        });

        it("resolves with the notification outcomes", function () {
          return expect(promises).to.eventually.deep.equal([
              { device: "abcd1234"},
              { device: "adfe5969", status: "400", response: { reason: "MissingTopic" } },
              { device: "abcd1335", status: "410", response: { reason: "BadDeviceToken", timestamp: 123456789 } },
              { device: "bcfe4433"},
              { device: "aabbc788", status: "413", response: { reason: "PayloadTooLarge" } },
          ]);
        });
      });

      context("some streams return, others wake up later", function () {
        let promises;

        beforeEach( function() {
          const client = new Client( { address: "testapi" } );

          fakes.endpointManager.getStream.onCall(0).returns(fakes.streams[0]);
          fakes.endpointManager.getStream.onCall(1).returns(fakes.streams[1]);

          promises = Promise.all([
            client.write(builtNotification(), "abcd1234"),
            client.write(builtNotification(), "adfe5969"),
            client.write(builtNotification(), "abcd1335"),
            client.write(builtNotification(), "bcfe4433"),
            client.write(builtNotification(), "aabbc788"),
          ]);

          setTimeout(function () {
            fakes.endpointManager.getStream.reset();
            fakes.endpointManager.getStream.onCall(0).returns(fakes.streams[2]);
            fakes.endpointManager.getStream.onCall(1).returns(null);
            fakes.endpointManager.emit("wakeup");
          }, 1);

          setTimeout(function () {
            fakes.endpointManager.getStream.reset();
            fakes.endpointManager.getStream.onCall(0).returns(fakes.streams[3]);
            fakes.endpointManager.getStream.onCall(1).returns(fakes.streams[4]);
            fakes.endpointManager.emit("wakeup");
          }, 2);

          return promises;
        });

        it("sends the correct device ID for each stream", function () {
          expect(fakes.streams[0].headers).to.be.calledWithMatch({":path": "/3/device/abcd1234"});
          expect(fakes.streams[1].headers).to.be.calledWithMatch({":path": "/3/device/adfe5969"});
          expect(fakes.streams[2].headers).to.be.calledWithMatch({":path": "/3/device/abcd1335"});
          expect(fakes.streams[3].headers).to.be.calledWithMatch({":path": "/3/device/bcfe4433"});
          expect(fakes.streams[4].headers).to.be.calledWithMatch({":path": "/3/device/aabbc788"});
        });

        it("writes the notification data for each stream", function () {
          fakes.streams.forEach( stream => {
            expect(stream._transform).to.be.calledWithMatch(actual => actual.equals(Buffer(builtNotification().body)));
          });
        });

        it("resolves with the notification reponses", function () {
          return expect(promises).to.eventually.deep.equal([
              { device: "abcd1234"},
              { device: "adfe5969", status: "400", response: { reason: "MissingTopic" } },
              { device: "abcd1335", status: "410", response: { reason: "BadDeviceToken", timestamp: 123456789 } },
              { device: "bcfe4433"},
              { device: "aabbc788", status: "413", response: { reason: "PayloadTooLarge" } },
          ]);
        });
      });

      context("connection fails", function () {
        let promises, client;

        beforeEach( function() {
          client = new Client( { address: "testapi" } );

          fakes.endpointManager.getStream.onCall(0).returns(fakes.streams[0]);

          promises = Promise.all([
            client.write(builtNotification(), "abcd1234"),
            client.write(builtNotification(), "adfe5969"),
            client.write(builtNotification(), "abcd1335"),
          ]);

          setTimeout(function () {
            fakes.endpointManager.getStream.reset();
            fakes.endpointManager.emit("error", new Error("endpoint failed"));
          }, 1);

          return promises;
        });

        it("resolves with 1 success", function () {
          return promises.then( response => {
            expect(response[0]).to.deep.equal({ device: "abcd1234" });
          });
        });

        it("resolves with 2 errors", function () {
          return promises.then( response => {
            expect(response[1]).to.deep.equal({ device: "adfe5969", error: new Error("endpoint failed") });
            expect(response[2]).to.deep.equal({ device: "abcd1335", error: new Error("endpoint failed") });
          })
        });

        it("clears the queue", function () {
          return promises.then( () => {
            expect(client.queue.length).to.equal(0);
          });
        });
      });

    });

    describe("token generator behaviour", function () {
      beforeEach(function () {
        fakes.token = {
          generation: 0,
          current: "fake-token",
          regenerate: sinon.stub(),
        }

        fakes.streams = [
          new FakeStream("abcd1234", "200"),
          new FakeStream("adfe5969", "400", { reason: "MissingTopic" }),
          new FakeStream("abcd1335", "410", { reason: "BadDeviceToken", timestamp: 123456789 }),
        ];
      });

      it("reuses the token", function () {
        const client = new Client( { address: "testapi", token: fakes.token } );

        fakes.token.regenerate = function () {
          fakes.token.generation = 1;
          fakes.token.current = "second-token";
        }

        fakes.endpointManager.getStream.onCall(0).returns(fakes.streams[0]);
        fakes.endpointManager.getStream.onCall(1).returns(fakes.streams[1]);
        fakes.endpointManager.getStream.onCall(2).returns(fakes.streams[2]);

        return Promise.all([
          client.write(builtNotification(), "abcd1234"),
          client.write(builtNotification(), "adfe5969"),
          client.write(builtNotification(), "abcd1335"),
        ]).then(function () {
          expect(fakes.streams[0].headers).to.be.calledWithMatch({ authorization: "bearer fake-token" });
          expect(fakes.streams[1].headers).to.be.calledWithMatch({ authorization: "bearer fake-token" });
          expect(fakes.streams[2].headers).to.be.calledWithMatch({ authorization: "bearer fake-token" });
        });
      });

      context("token expires", function () {

        beforeEach(function () {
          fakes.token.regenerate = function (generation) {
            if (generation === fakes.token.generation) {
              fakes.token.generation += 1;
              fakes.token.current = "token-" + fakes.token.generation;
            }
          }
        });

        it("resends the notification with a new token", function () {
          fakes.streams = [
            new FakeStream("adfe5969", "403", { reason: "ExpiredProviderToken" }),
            new FakeStream("adfe5969", "200"),
          ];

          fakes.endpointManager.getStream.onCall(0).returns(fakes.streams[0]);

          const client = new Client( { address: "testapi", token: fakes.token } );

          const promise = client.write(builtNotification(), "adfe5969");

          setTimeout(function () {
            fakes.endpointManager.getStream.reset();
            fakes.endpointManager.getStream.onCall(0).returns(fakes.streams[1]);
            fakes.endpointManager.emit("wakeup");
          }, 1);

          return promise.then(function () {
            expect(fakes.streams[0].headers).to.be.calledWithMatch({ authorization: "bearer fake-token" });
            expect(fakes.streams[1].headers).to.be.calledWithMatch({ authorization: "bearer token-1" });
          });
        });

        it("only regenerates the token once per-expiry", function () {
          fakes.streams = [
            new FakeStream("abcd1234", "200"),
            new FakeStream("adfe5969", "403", { reason: "ExpiredProviderToken" }),
            new FakeStream("abcd1335", "403", { reason: "ExpiredProviderToken" }),
            new FakeStream("adfe5969", "400", { reason: "MissingTopic" }),
            new FakeStream("abcd1335", "410", { reason: "BadDeviceToken", timestamp: 123456789 }),
          ];

          fakes.endpointManager.getStream.onCall(0).returns(fakes.streams[0]);
          fakes.endpointManager.getStream.onCall(1).returns(fakes.streams[1]);
          fakes.endpointManager.getStream.onCall(2).returns(fakes.streams[2]);

          const client = new Client( { address: "testapi", token: fakes.token } );

          const promises = Promise.all([
            client.write(builtNotification(), "abcd1234"),
            client.write(builtNotification(), "adfe5969"),
            client.write(builtNotification(), "abcd1335"),
          ]);

          setTimeout(function () {
            fakes.endpointManager.getStream.reset();
            fakes.endpointManager.getStream.onCall(0).returns(fakes.streams[3]);
            fakes.endpointManager.getStream.onCall(1).returns(fakes.streams[4]);
            fakes.endpointManager.emit("wakeup");
          }, 1);

          return promises.then(function () {
            expect(fakes.streams[0].headers).to.be.calledWithMatch({ authorization: "bearer fake-token" });
            expect(fakes.streams[1].headers).to.be.calledWithMatch({ authorization: "bearer fake-token" });
            expect(fakes.streams[2].headers).to.be.calledWithMatch({ authorization: "bearer fake-token" });
            expect(fakes.streams[3].headers).to.be.calledWithMatch({ authorization: "bearer token-1" });
            expect(fakes.streams[4].headers).to.be.calledWithMatch({ authorization: "bearer token-1" });
          });
        });

        it("abandons sending after 3 ExpiredProviderToken failures", function () {
          fakes.streams = [
            new FakeStream("adfe5969", "403", { reason: "ExpiredProviderToken" }),
            new FakeStream("adfe5969", "403", { reason: "ExpiredProviderToken" }),
            new FakeStream("adfe5969", "403", { reason: "ExpiredProviderToken" }),
          ];

          fakes.endpointManager.getStream.onCall(0).returns(fakes.streams[0]);
          fakes.endpointManager.getStream.onCall(1).returns(fakes.streams[1]);
          fakes.endpointManager.getStream.onCall(2).returns(fakes.streams[2]);

          const client = new Client( { address: "testapi", token: fakes.token } );

          return expect(client.write(builtNotification(), "adfe5969")).to.eventually.have.property("status", "403");
        });
      });
    });
  });

  describe("shutdown", function () {
    beforeEach(function () {
      fakes.config.returnsArg(0);
      fakes.endpointManager.getStream = sinon.stub();

      fakes.EndpointManager.returns(fakes.endpointManager);
    });

    context("with no pending notifications", function () {
      it("invokes shutdown on endpoint manager", function () {
        let client = new Client();
        client.shutdown();

        expect(fakes.endpointManager.shutdown).to.be.calledOnce;
      });
    });

    context("with pending notifications", function () {
      it("invokes shutdown on endpoint manager after queue drains", function () {
        let client = new Client({ address: "none" });

        fakes.streams = [
          new FakeStream("abcd1234", "200"),
          new FakeStream("adfe5969", "400", { reason: "MissingTopic" }),
          new FakeStream("abcd1335", "410", { reason: "BadDeviceToken", timestamp: 123456789 }),
          new FakeStream("bcfe4433", "200"),
          new FakeStream("aabbc788", "413", { reason: "PayloadTooLarge" }),
        ];

        fakes.endpointManager.getStream.onCall(0).returns(fakes.streams[0]);
        fakes.endpointManager.getStream.onCall(1).returns(fakes.streams[1]);

        let promises = Promise.all([
          client.write(builtNotification(), "abcd1234"),
          client.write(builtNotification(), "adfe5969"),
          client.write(builtNotification(), "abcd1335"),
          client.write(builtNotification(), "bcfe4433"),
          client.write(builtNotification(), "aabbc788"),
        ]);

        client.shutdown();

        expect(fakes.endpointManager.shutdown).to.not.be.called;

        setTimeout(function () {
          fakes.endpointManager.getStream.reset();
          fakes.endpointManager.getStream.onCall(0).returns(fakes.streams[2]);
          fakes.endpointManager.getStream.onCall(1).returns(null);
          fakes.endpointManager.emit("wakeup");
        }, 1);

        setTimeout(function () {
          fakes.endpointManager.getStream.reset();
          fakes.endpointManager.getStream.onCall(0).returns(fakes.streams[3]);
          fakes.endpointManager.getStream.onCall(1).returns(fakes.streams[4]);
          fakes.endpointManager.emit("wakeup");
        }, 2);

        return promises.then( () => {
          expect(fakes.endpointManager.shutdown).to.have.been.called;
        });
      });
    });
  });
});

function builtNotification() {
  return {
    headers: {},
    body: JSON.stringify({ aps: { badge: 1 } }),
  };
}

function FakeStream(deviceId, statusCode, response) {
  const fakeStream = new stream.Transform({
    transform: sinon.spy(function(chunk, encoding, callback) {
      expect(this.headers).to.be.calledOnce;

      const headers = this.headers.firstCall.args[0];
      expect(headers[":path"].substring(10)).to.equal(deviceId);

      this.emit("headers", {
        ":status": statusCode
      });
      callback(null, new Buffer(JSON.stringify(response) || ""));
    })
  });
  fakeStream.headers = sinon.stub();

  return fakeStream;
}

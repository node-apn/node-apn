"use strict";

const sinon = require("sinon");
const stream = require("stream");

describe("Connection", function() {
	let fakes, Connection;

	beforeEach(() => {
		fakes = {
			config: sinon.stub(),
			EndpointManager: sinon.stub(),
		}

		Connection = require("../lib/connection")(fakes)
	})

	describe("constructor", function () {

		context("called without `new`", () => {
			it("returns a new instance", () => {
				expect(Connection()).to.be.an.instanceof(Connection);
			});
		});

		it("prepares the configuration with passed options", () => {
			let options = { production: true };
			let connection = Connection(options);

			expect(fakes.config).to.be.calledWith(options);
		});

		describe("EndpointManager instance", function() {
			it("is created", () => {
				Connection();

				expect(fakes.EndpointManager).to.be.calledOnce;
				expect(fakes.EndpointManager).to.be.calledWithNew;
			});

			it("is passed the prepared configuration", () => {
				const returnSentinel = { "configKey": "configValue"};
				fakes.config.returns(returnSentinel);

				Connection({});
				expect(fakes.EndpointManager).to.be.calledWith(returnSentinel);
			});
		});
	});

	describe("pushNotification", () => {

    beforeEach(() => {
      fakes.config.returnsArg(0);
      fakes.endpointManager = {
        getStream: sinon.stub(),
      }
      fakes.EndpointManager.returns(fakes.endpointManager);
    });

		context("a single stream is available", () => {

			context("a single token is passed", () => {
				let promise;

				context("transmission succeeds", () => {
					beforeEach(() => {
						const connection = new Connection( { address: "testapi" } );

						fakes.stream = new FakeStream("abcd1234", 200);
						fakes.endpointManager.getStream.onCall(0).returns(fakes.stream);

						promise = connection.pushNotification(notificationDouble(), "abcd1234");
					});

					it("attempts to acquire one stream", () => {
						expect(fakes.endpointManager.getStream).to.be.calledOnce;
					});

					it("sends the required headers", () => {
						expect(fakes.stream.headers).to.be.calledWith( {
		          ":scheme": "https",
		          ":method": "POST",
		          ":authority": "testapi",
		          ":path": "/3/device/abcd1234",
		          "content-length": Buffer.byteLength(notificationDouble().compile()),
		        } );
					});

					it("writes the notification data to the pipe", () => {
						const writtenData = fakes.stream._transform.firstCall.args[0];
						expect(writtenData).to.deep.equal(Buffer(notificationDouble().compile()));
					});

					it("ends the stream", () => {
						expect(() => fakes.stream.write("ended?")).to.throw("write after end");
					});

					it("resolves with the device token in the success array", () => {
						return expect(promise).to.eventually.deep.equal([[{"device": "abcd1234"}], []]);
					});
				});

				context("error occurs", () => {
					let promise;

					beforeEach(() => {
						const connection = new Connection( { address: "testapi" } );

						fakes.stream = new FakeStream("abcd1234", 400, { "reason" : "BadDeviceToken" });
						fakes.endpointManager.getStream.onCall(0).returns(fakes.stream);

						promise = connection.pushNotification(notificationDouble(), "abcd1234");
					});

					it("resolves with the device token, status code and response in the failed array", () => {
						return expect(promise).to.eventually.deep.equal([[], [{"device": "abcd1234", "status": 400, "response": { "reason" : "BadDeviceToken" }}]])
					});
				});
			});

			xcontext("no new stream is returned but the endpoint later wakes up", () => {
				it("sends the required headers", () => {
				});
				it("writes the notification data to the pipe", () => {
				});
			});
		});

		xcontext("transmission succeeds", () => {
			it("resolves with the device token in the success array", () => {
			});
		});
		xcontext("error occurs", () => {
			it("resolves with the device token, status code and response in the failed array", () => {
			});
		});

		xcontext("when 10 tokens are passed", () => {
			context("streams are always returned", () => {
				it("sends the required headers for each stream", () => {
				});
				it("writes the notification data for each stream", () => {
				});
				it("resolves with the successful notifications", () => {
				});
				it("resolves with the device token, status code and response of the unsuccessful notifications", () => {
				});
			});
		
			context("some streams return, others wake up later", () => {
				it("sends the required headers for each stream", () => {
				});
				it("writes the notification data for each stream", () => {
				});
				it("resolves with the successful notifications", () => {
				});
				it("resolves with the device token, status code and response of the unsuccessful notifications", () => {
				});
			});
	  });
	});
});

function notificationDouble() {
	return {
		payload: { aps: { badge: 1 } },
		topic: "io.apn.node",
		compile: function() { return JSON.stringify(this.payload); }
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
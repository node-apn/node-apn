"use strict";

const sinon = require("sinon");
const stream = require("stream");
const EventEmitter = require("events");

const bunyanLogger = sinon.match({
  fatal: sinon.match.func,
  warn: sinon.match.func,
  info: sinon.match.func,
  debug: sinon.match.func,
  trace: sinon.match.func,
  child: sinon.match.func
});

describe("Endpoint", function () {
  let fakes, streams, Endpoint;

  beforeEach(function () {    
    fakes = {
      tls: {
        connect: sinon.stub()
      },
      http: {
        request: sinon.stub()
      },
      protocol: {
        Connection:   sinon.stub(),
        Serializer:   sinon.stub(),
        Deserializer: sinon.stub(),
        Compressor:   sinon.stub(),
        Decompressor: sinon.stub(),
      },
    };

    streams = {
      socket:         new stream.PassThrough(),
      tunneledSocket: new stream.PassThrough(),
      connection:     new stream.PassThrough(),
      serializer:     new stream.PassThrough(),
      deserializer:   new stream.PassThrough(),
      compressor:     new stream.PassThrough(),
      decompressor:   new stream.PassThrough(),
    };

    // These streams should never actually pass writable -> readable
    // otherwise the tests create an infinite loop. The real streams terminate.
    // PassThrough is just an easy way to inspect the stream behaviour.
    sinon.stub(streams.socket, "pipe");
    sinon.stub(streams.tunneledSocket, "pipe");
    sinon.stub(streams.connection, "pipe");

    streams.connection._allocateId = sinon.stub();

    streams.compressor.setTableSizeLimit = sinon.spy();
    streams.decompressor.setTableSizeLimit = sinon.spy();

    fakes.tls.connect.returns(streams.socket);
    fakes.protocol.Connection.returns(streams.connection);
    fakes.protocol.Serializer.returns(streams.serializer);
    fakes.protocol.Deserializer.returns(streams.deserializer);
    fakes.protocol.Compressor.returns(streams.compressor);
    fakes.protocol.Decompressor.returns(streams.decompressor);

    Endpoint = require("../../lib/protocol/endpoint")(fakes);
  });

  describe("connect", function () {
    describe("tls socket", function () {

      it("is created", function () {
        new Endpoint({});

        expect(fakes.tls.connect).to.be.calledOnce;
      });

      describe("connection parameters", function () {

        context("all supplied", function () {

          beforeEach(function () {
            new Endpoint({
              address: "localtest", host: "127.0.0.1", port: 443,
              pfx: "pfxData", cert: "certData",
              key: "keyData", passphrase: "p4ssphr4s3"
            });
          });

          it("includes the host and port and servername", function () {
            expect(fakes.tls.connect).to.be.calledWith(sinon.match({
              host: "127.0.0.1",
              port: 443,
              servername: "localtest"
            }));
          });

          it("includes the ALPNProtocols", function () {
            expect(fakes.tls.connect).to.be.calledWith(sinon.match({
              ALPNProtocols: ["h2"]
            }));
          });

          it("includes the credentials", function () {
            expect(fakes.tls.connect).to.be.calledWith(sinon.match({
              pfx: "pfxData",
              cert: "certData",
              key: "keyData",
              passphrase: "p4ssphr4s3"
            }));
          });
        });

        context("host is not omitted", function () {
          it("falls back on 'address'", function () {
            new Endpoint({
              address: "localtest", port: 443
            });

            expect(fakes.tls.connect).to.be.calledWith(sinon.match({
              host: "localtest",
              port: 443,
              servername: "localtest"
            }));
          });
        });
      });

      context("connection established", function () {
        it("writes the HTTP/2 prelude", function () {
          sinon.spy(streams.socket, "write");

          new Endpoint({});

          streams.socket.emit("secureConnect");

          const HTTP2_PRELUDE = Buffer.from("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");

          expect(streams.socket.write.firstCall).to.be.calledWith(HTTP2_PRELUDE);
        });

        it("emits 'connect' event", function () {
          const endpoint = new Endpoint({});
          let connect = sinon.spy();

          endpoint.on("connect", connect);
          streams.socket.emit("secureConnect");
          expect(connect).to.be.calledOnce;
        });
      });

      it("bubbles error events", function () {
        const endpoint = new Endpoint({});
        const errorSpy = sinon.spy();
        endpoint.on("error", errorSpy);

        streams.socket.emit("error", "this should be bubbled");

        expect(errorSpy).to.have.been.calledWith("this should be bubbled");
      });

      it("bubbles end events", function () {
        const endpoint = new Endpoint({});
        const endSpy = sinon.spy();
        endpoint.on("end", endSpy);

        streams.socket.emit("end");

        expect(endSpy).to.have.been.calledOnce;
      });
    });

    context("using an HTTP proxy", function () {
      let endpointOptions;
      let fakeHttpRequest;

      beforeEach(function(){
        endpointOptions = {
          address: "localtest", 
          port: 443,
          proxy: {host: "proxyaddress", port: 8080}
        };

        fakeHttpRequest = new EventEmitter();
        Object.assign(fakeHttpRequest, {
          end: sinon.stub()
        });        

        fakes.http.request
          .withArgs(sinon.match({
            host: "proxyaddress",
            port: 8080,
            method: "CONNECT",
            headers: { Connection: "Keep-Alive" },
            path: "localtest:443",
          }))
          .returns(fakeHttpRequest);
      });

      it("sends an HTTP CONNECT request to the proxy", function () {
        const endpoint = new Endpoint(endpointOptions);
        
        expect(fakeHttpRequest.end).to.have.been.calledOnce;
      });

      it("bubbles error events from the HTTP request", function () {
        const endpoint = new Endpoint(endpointOptions);
        const errorSpy = sinon.spy();
        endpoint.on("error", errorSpy);

        fakeHttpRequest.emit("error", "this should be bubbled");

        expect(errorSpy).to.have.been.calledWith("this should be bubbled");
      });

      it("opens tls socket using the tunnel socket from the HTTP request", function() {
        const endpoint = new Endpoint(endpointOptions);
        const httpSocket = {the: "HTTP socket"};
        fakeHttpRequest.emit("connect", null, httpSocket);

        expect(fakes.tls.connect).to.have.been.calledOnce;
        expect(fakes.tls.connect).to.have.been.calledWith(sinon.match({
          socket: httpSocket,
          host: "localtest",
          port: 443
        }));
      });

      it("uses all the additional options when openning the tls socket using the tunnel socket from the HTTP request", function() {
        endpointOptions = Object.assign(endpointOptions, {
          address: "localtestaddress", host: "localtest", port: 443,
          pfx: "pfxData", cert: "certData",
          key: "keyData", passphrase: "p4ssphr4s3",
          rejectUnauthorized: true,
          ALPNProtocols: ["h2"]
        });
        const endpoint = new Endpoint(endpointOptions);
        const httpSocket = {the: "HTTP socket"};
        fakeHttpRequest.emit("connect", null, httpSocket);

        expect(fakes.tls.connect).to.have.been.calledWith(sinon.match({
          socket: httpSocket,
          host: "localtest",
          port: 443,
          servername: "localtestaddress",
          pfx: "pfxData", cert: "certData",
          key: "keyData", passphrase: "p4ssphr4s3",
          rejectUnauthorized: true,
          ALPNProtocols: ["h2"]
        }));
      });

      context("tunnel established", function () {
        let endpoint;
        let httpSocket;
        
        beforeEach(function(){          
          endpoint = new Endpoint(endpointOptions);
          httpSocket = {the: "HTTP socket"};

          fakes.tls.connect.withArgs(sinon.match({
            socket: httpSocket,
            host: "localtest",
            port: 443
          })).returns(streams.tunneledSocket);
          sinon.spy(streams.tunneledSocket, "write");

          fakeHttpRequest.emit("connect", null, httpSocket);
        });

        it("writes the HTTP/2 prelude", function () {          
          const HTTP2_PRELUDE = Buffer.from("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");
          
          expect(streams.tunneledSocket.write.firstCall).to.be.calledWith(HTTP2_PRELUDE);
        });

        it("emits 'connect' event once secure connection with end host is established", function () {          
          const connect = sinon.spy();

          endpoint.on("connect", connect);
          streams.tunneledSocket.emit("secureConnect");
          expect(connect).to.be.calledOnce;
        });

        it("bubbles error events", function () {
          const errorSpy = sinon.spy();
          endpoint.on("error", errorSpy);
  
          streams.tunneledSocket.emit("error", "this should be bubbled");
  
          expect(errorSpy).to.have.been.calledWith("this should be bubbled");
        });
  
        it("bubbles end events", function () {
          const endSpy = sinon.spy();
          endpoint.on("end", endSpy);
  
          streams.tunneledSocket.emit("end");
  
          expect(endSpy).to.have.been.calledOnce;
        });
      });      
    });

    describe("HTTP/2 layer", function () {
      let endpoint;

      beforeEach(function () {
        endpoint = new Endpoint({});
      });

      describe("connection", function () {
        it("is created", function () {
          expect(fakes.protocol.Connection).to.have.been.calledWithNew;
          expect(fakes.protocol.Connection).to.have.been.calledOnce;
        });

        it("is passed the correct parameters", function () {

          // Empty bunyan logger
          expect(fakes.protocol.Connection).to.have.been.calledWith(bunyanLogger);

          // First stream ID
          expect(fakes.protocol.Connection).to.have.been.calledWith(sinon.match.any, 1);
        });

        it("bubbles error events with label", function () {
          const errorSpy = sinon.spy();
          endpoint.on("error", errorSpy);

          streams.connection.emit("error", "this should be bubbled");

          expect(errorSpy).to.have.been.calledWith("connection error: this should be bubbled");
        });
      });

      describe("serializer", function () {
        it("is created", function () {
          expect(fakes.protocol.Serializer).to.have.been.calledWithNew;
          expect(fakes.protocol.Serializer).to.have.been.calledOnce;
        });

        it("is passed the logger", function () {
          expect(fakes.protocol.Serializer).to.have.been.calledWith(bunyanLogger);
        });

        it("bubbles error events with label", function () {
          const errorSpy = sinon.spy();
          endpoint.on("error", errorSpy);

          streams.serializer.emit("error", "this should be bubbled");

          expect(errorSpy).to.have.been.calledWith("serializer error: this should be bubbled");
        });
      });

      describe("deserializer", function () {
        it("is created", function () {
          expect(fakes.protocol.Deserializer).to.have.been.calledWithNew;
          expect(fakes.protocol.Deserializer).to.have.been.calledOnce;
        });

        it("is passed the logger", function () {
          expect(fakes.protocol.Deserializer).to.have.been.calledWith(bunyanLogger);
        });

        it("bubbles error events with label", function () {
          const errorSpy = sinon.spy();
          endpoint.on("error", errorSpy);

          streams.deserializer.emit("error", "this should be bubbled");

          expect(errorSpy).to.have.been.calledWith("deserializer error: this should be bubbled");
        });
      });

      describe("compressor", function () {
        it("is created", function () {
          expect(fakes.protocol.Compressor).to.have.been.calledWithNew;
          expect(fakes.protocol.Compressor).to.have.been.calledOnce;
        });

        it("is passed the correct parameters", function () {
          expect(fakes.protocol.Compressor).to.have.been.calledWith(bunyanLogger);
          expect(fakes.protocol.Compressor).to.have.been.calledWith(sinon.match.any, "REQUEST");
        });

        it("handles HEADER_TABLE_SIZE settings update", function () {
          streams.connection.emit("RECEIVING_SETTINGS_HEADER_TABLE_SIZE", 1000);
          expect(streams.compressor.setTableSizeLimit).to.have.been.calledWith(1000);
        });

        it("bubbles error events", function () {
          const errorSpy = sinon.spy();
          endpoint.on("error", errorSpy);

          streams.compressor.emit("error", "this should be bubbled");

          expect(errorSpy).to.have.been.calledWith("compressor error: this should be bubbled");
        });
      });

      describe("decompressor", function () {
        it("is created", function () {
          expect(fakes.protocol.Decompressor).to.have.been.calledWithNew;
          expect(fakes.protocol.Decompressor).to.have.been.calledOnce;
        });

        it("is passed the correct parameters", function () {
          expect(fakes.protocol.Decompressor).to.have.been.calledWith(bunyanLogger);
          expect(fakes.protocol.Decompressor).to.have.been.calledWith(sinon.match.any, "RESPONSE");
        });

        it("handles HEADER_TABLE_SIZE settings acknowledgement", function () {
          streams.connection.emit("ACKNOWLEDGED_SETTINGS_HEADER_TABLE_SIZE", 1000);
          expect(streams.decompressor.setTableSizeLimit).to.have.been.calledWith(1000);
        });

        it("bubbles error events", function () {
          const errorSpy = sinon.spy();
          endpoint.on("error", errorSpy);

          streams.decompressor.emit("error", "this should be bubbled");

          expect(errorSpy).to.have.been.calledWith("decompressor error: this should be bubbled");
        });
      });
    });
  });

  describe("stream behaviour", function () {

    beforeEach(function () {
      sinon.stub(streams.serializer, "pipe");
      sinon.stub(streams.deserializer, "pipe");
      sinon.stub(streams.compressor, "pipe");
      sinon.stub(streams.decompressor, "pipe");

      sinon.spy(streams.socket, "write");

      new Endpoint({});
    });

    it("pipes the tls socket to the deserializer", function () {
      expect(streams.socket.pipe).to.be.calledWith(streams.deserializer);
      expect(streams.socket.pipe).to.be.calledAfter(streams.socket.write);
    });

    it("pipes the serializer to the tls socket", function () {
      expect(streams.serializer.pipe).to.be.calledWith(streams.socket);
      expect(streams.socket.pipe).to.be.calledAfter(streams.socket.write);
    });

    it("pipes the connection to the compressor", function () {
      expect(streams.connection.pipe).to.be.calledWith(streams.compressor);
    });

    it("pipes the compressor to the serializer", function () {
      expect(streams.compressor.pipe).to.be.calledWith(streams.serializer);
    });

    it("pipes the deserializer to the decompressor", function () {
      expect(streams.deserializer.pipe).to.be.calledWith(streams.decompressor);
    });

    it("pipes the decompressor to the connection", function () {
      expect(streams.decompressor.pipe).to.be.calledWith(streams.connection);
    });
  });

  describe("available stream slots", function () {
    let endpoint;

    beforeEach(function () {
      endpoint = new Endpoint({});
      streams.connection.createStream = sinon.stub().returns(new stream.PassThrough());

      expect(endpoint.availableStreamSlots).to.equal(0);
      streams.connection.emit("RECEIVING_SETTINGS_MAX_CONCURRENT_STREAMS", 5);
      expect(endpoint.availableStreamSlots).to.equal(5);
    });

    it("reflects the received settings value", function () {
      streams.connection.emit("RECEIVING_SETTINGS_MAX_CONCURRENT_STREAMS", 1024);
      expect(endpoint.availableStreamSlots).to.equal(1024);
    });

    it("reduces when a stream is created", function () {
      endpoint.createStream();
      expect(endpoint.availableStreamSlots).to.equal(4);
    });

    it("increases when a stream ends", function () {
      const stream = endpoint.createStream();

      stream.emit("end");
      expect(endpoint.availableStreamSlots).to.equal(5);
    });
  });

  describe("error occurrence", function () {
    let promises;

    beforeEach(function () {
      let endpoint = new Endpoint({});
      endpoint.on("error", () => {});

      streams.connection._streamIds = [];

      // Stream 0 is an exception and should not triggered
      streams.connection._streamIds[0] = new stream.PassThrough();

      promises = [];
      function erroringStream() {
        let s = new stream.PassThrough();
        promises.push(new Promise( resolve => {
          s.on("error", function(err) {
            resolve(err);
          });
        }));

        return s;
      }

      streams.connection._streamIds[5] = erroringStream();
      streams.connection._streamIds[7] = erroringStream();
      streams.connection._streamIds[9] = erroringStream();
    });

    context("socket error", function () {
      it("emits the error from all active streams after close", function () {
        let error = new Error("socket failed");
        streams.socket.emit("error", error);
        streams.socket.emit("close", true);

        return expect(Promise.all(promises)).to.eventually.deep.equal([
          error, error, error,
        ]);
      });

      it("does not emit `unprocessed` on any streams", function () {
        let unprocessedSpy = sinon.spy();

        streams.connection._streamIds[5].on("unprocessed", unprocessedSpy);
        streams.connection._streamIds[7].on("unprocessed", unprocessedSpy);
        streams.connection._streamIds[9].on("unprocessed", unprocessedSpy);

        let error = new Error("socket failed");
        streams.socket.emit("error", error);
        streams.socket.emit("close", true);

        expect(unprocessedSpy).to.not.be.called;
      });
    });

    context("connection error", function () {
      it("emits an error with the code from all active streams", function () {
        streams.connection.emit("error", "PROTOCOL_ERROR");
        streams.socket.emit("close", false);

        return Promise.all(promises).then( responses => {
          expect(responses[0]).to.match(/connection error: PROTOCOL_ERROR/);
          expect(responses[1]).to.match(/connection error: PROTOCOL_ERROR/);
          expect(responses[2]).to.match(/connection error: PROTOCOL_ERROR/);
        });
      });
    });

    context("serializer error", function () {
      it("emits an error with the code from all active streams", function () {
        streams.serializer.emit("error", "PROTOCOL_ERROR");
        streams.socket.emit("close", false);

        return Promise.all(promises).then( responses => {
          expect(responses[0]).to.match(/serializer error: PROTOCOL_ERROR/);
          expect(responses[1]).to.match(/serializer error: PROTOCOL_ERROR/);
          expect(responses[2]).to.match(/serializer error: PROTOCOL_ERROR/);
        });
      });
    });

    context("compressor error", function () {
      it("emits an error with the code from all active streams", function () {
        streams.compressor.emit("error", "PROTOCOL_ERROR");
        streams.socket.emit("close", false);

        return Promise.all(promises).then( responses => {
          expect(responses[0]).to.match(/compressor error: PROTOCOL_ERROR/);
          expect(responses[1]).to.match(/compressor error: PROTOCOL_ERROR/);
          expect(responses[2]).to.match(/compressor error: PROTOCOL_ERROR/);
        });
      });
    });

    context("deserializer error", function () {
      it("emits an error with the code from all active streams", function () {
        streams.deserializer.emit("error", "PROTOCOL_ERROR");
        streams.socket.emit("close", false);

        return Promise.all(promises).then( responses => {
          expect(responses[0]).to.match(/deserializer error: PROTOCOL_ERROR/);
          expect(responses[1]).to.match(/deserializer error: PROTOCOL_ERROR/);
          expect(responses[2]).to.match(/deserializer error: PROTOCOL_ERROR/);
        });
      });
    });

    context("decompressor error", function () {
      it("emits an error with the code from all active streams", function () {
        streams.decompressor.emit("error", "PROTOCOL_ERROR");
        streams.socket.emit("close", false);

        return Promise.all(promises).then( responses => {
          expect(responses[0]).to.match(/decompressor error: PROTOCOL_ERROR/);
          expect(responses[1]).to.match(/decompressor error: PROTOCOL_ERROR/);
          expect(responses[2]).to.match(/decompressor error: PROTOCOL_ERROR/);
        });
      });
    });
  });

  describe("`GOAWAY` received", function () {
    let frame, errorSpy;

    beforeEach(function () {
      let endpoint = new Endpoint({});

      errorSpy = sinon.spy();
      endpoint.on("error", errorSpy);
    });

    context("no error", function () {
      it("does not emit an error", function () {
        streams.connection.emit("GOAWAY", { error: "NO_ERROR" });

        expect(errorSpy).to.not.be.called;
      });

      context("some streams are unprocessed", function () {
        beforeEach(function () {
          streams.connection._streamIds = [];

          // Stream 0 is an exception and should not triggered
          streams.connection._streamIds[0] = new stream.PassThrough();

          streams.connection._streamIds[5] = new stream.PassThrough();
          streams.connection._streamIds[7] = new stream.PassThrough();
          streams.connection._streamIds[9] = new stream.PassThrough();
        });

        it("does not emit `unprocessed` on streams below `last_stream`", function () {
          let spy = sinon.spy();
          streams.connection._streamIds[5].on("unprocessed", spy);

          streams.connection.emit("GOAWAY", { error: "NO_ERROR", last_stream: 5 });
          streams.socket.emit("close");

          expect(spy).to.not.be.called;
        });

        it("emits `unprocessed` on streams above `last_stream`", function () {
          let spy7 = sinon.spy();
          streams.connection._streamIds[7].on("unprocessed", spy7);

          let spy9 = sinon.spy();
          streams.connection._streamIds[9].on("unprocessed", spy9);

          streams.connection.emit("GOAWAY", { error: "NO_ERROR", last_stream: 5 });
          streams.socket.emit("close");

          expect(spy7).to.be.calledOnce;
          expect(spy9).to.be.calledOnce;
        });

        it("does not emit any errors on streams below `last_stream`", function () {
          let errorSpy = sinon.spy();
          streams.connection._streamIds[5].on("error", errorSpy);
          streams.connection._streamIds[7].on("error", errorSpy);

          streams.connection.emit("GOAWAY", { error: "NO_ERROR", last_stream: 7 });
          streams.socket.emit("close");

          expect(errorSpy).to.not.be.called;
        });
      });
    });

    context("with error", function () {
      const debugData = Buffer.alloc(6);
      debugData.write("error!");

      const formattedError = "GOAWAY: PROTOCOL_ERROR error!";

      beforeEach(function () {
        frame = { error: "PROTOCOL_ERROR", debug_data: debugData };
      });

      it("emits an error with the type and debug data", function () {
        streams.connection.emit("GOAWAY", frame);

        expect(errorSpy).to.be.calledWith(formattedError);
      });

      context("some streams are unprocessed", function () {

        beforeEach(function () {
          streams.connection._streamIds = [];

          // Stream 0 is an exception and should not triggered
          streams.connection._streamIds[0] = new stream.PassThrough();

          function erroringStream() {
            let s = new stream.PassThrough();
            s.on("error", () => {});

            return s;
          }

          streams.connection._streamIds[5] = erroringStream();
          streams.connection._streamIds[7] = erroringStream();
          streams.connection._streamIds[9] = erroringStream();
        });

        it("does not emit `unprocessed` on streams below `last_stream`", function () {
          let spy = sinon.spy();
          streams.connection._streamIds[5].on("unprocessed", spy);

          frame.last_stream = 5;
          streams.connection.emit("GOAWAY", frame);
          streams.socket.emit("close");

          expect(spy).to.not.be.called;
        });

        it("emits `unprocessed` on streams above `last_stream`", function () {
          let spy7 = sinon.spy();
          streams.connection._streamIds[7].on("unprocessed", spy7);

          let spy9 = sinon.spy();
          streams.connection._streamIds[9].on("unprocessed", spy9);

          frame.last_stream = 5;
          streams.connection.emit("GOAWAY", frame);
          streams.socket.emit("close");

          expect(spy7).to.be.calledOnce;
          expect(spy9).to.be.calledOnce;
        });

        it("emits the formatted error on streams below `last_stream`", function () {
          let errorSpy = sinon.spy();
          streams.connection._streamIds[5].on("error", errorSpy);
          streams.connection._streamIds[7].on("error", errorSpy);

          frame.last_stream = 7;
          streams.connection.emit("GOAWAY", frame);
          streams.socket.emit("close");

          expect(errorSpy).to.be.calledTwice.and.calledWith(formattedError);
        });
      });
    });
  });

  describe("`wakeup` event", function () {

    context("when max concurrent streams limit updates", function () {
      it("emits", function () {
        const endpoint = new Endpoint({});
        const wakeupSpy = sinon.spy();
        endpoint.on("wakeup", wakeupSpy);

        streams.connection.emit("RECEIVING_SETTINGS_MAX_CONCURRENT_STREAMS", 5);

        expect(wakeupSpy).to.have.been.calledOnce;
      });
    });

    context("when stream ends", function () {
      it("emits", function () {
        const endpoint = new Endpoint({});
        const wakeupSpy = sinon.spy();
        endpoint.on("wakeup", wakeupSpy);

        streams.connection.createStream = sinon.stub().returns(new stream.PassThrough());
        endpoint.createStream().emit("end");

        expect(wakeupSpy).to.have.been.calledOnce;
      });
    });
  });

  describe("createStream", function () {
    let endpoint;

    beforeEach(function () {
      streams.connection.createStream = sinon.stub().returns(new stream.PassThrough());
      endpoint = new Endpoint({});
    });

    it("calls createStream on the connection", function () {
      endpoint.createStream();

      expect(streams.connection.createStream).to.have.been.calledOnce;
    });

    it("allocates a stream ID", function () {
      let stream = endpoint.createStream();

      expect(streams.connection._allocateId).to.be.calledWith(stream);
    });

    it("passes the return value from the connection", function () {
      let stream = endpoint.createStream();
      let connectionStream = streams.connection.createStream.firstCall.returnValue;

      expect(stream).to.deep.equal(connectionStream);
    });
  });

  describe("close", function () {
    context("when there are no acquired streams", function () {
      it("calls close on the connection", function () {
        const endpoint = new Endpoint({});

        streams.connection.emit("RECEIVING_SETTINGS_MAX_CONCURRENT_STREAMS", 5);
        streams.connection.close = sinon.stub();

        endpoint.close();
        expect(streams.connection.close).to.have.been.calledOnce;
      });
    });

    context("when there is an acquired stream", function () {
      it("waits until all streams are closed to call close on the connection", function () {
        const endpoint = new Endpoint({});

        streams.connection.createStream = sinon.stub().returns(new stream.PassThrough());
        streams.connection.emit("RECEIVING_SETTINGS_MAX_CONCURRENT_STREAMS", 5);

        const createdStream = endpoint.createStream();
        streams.connection.close = sinon.stub();

        endpoint.close();
        expect(streams.connection.close).to.have.not.been.called;

        createdStream.emit("end");
        expect(streams.connection.close).to.have.been.calledOnce;
      });
    });
  });

  describe("destroy", function () {
    let endpoint;

    beforeEach(function () {
      endpoint = new Endpoint({});
      streams.socket.destroy = sinon.stub();
    });

    it("destroys the underlying socket", function () {
      endpoint.destroy();

      expect(streams.socket.destroy).to.be.calledOnce;
    });
  });

  describe("ping", function () {
    let endpoint;
    beforeEach(function () {
      streams.connection.ping = (a) => {};
      sinon.stub(streams.connection, "ping").callsFake((callback) => {
        callback();
      });
      this.clock = sinon.useFakeTimers();
      endpoint = new Endpoint({
        heartBeat: 1
      });
    });
    afterEach(function () {
      this.clock.restore();
    });

    it("should update last success pinged time", function () {
      this.clock.tick(10);
      expect(endpoint._lastSuccessPingedTime).to.not.equal(null);
    });

    it("should throw error when pinged failed", function () {
      endpoint._lastSuccessPingedTime = Date.now() - endpoint._pingedThreshold;
      try {
        this.clock.tick(10);
      } catch (error) {
        var e = error;
      }
      expect(endpoint.lastError).to.have.string("Not receiving Ping response after");
    });
  });
});

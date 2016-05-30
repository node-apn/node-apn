"use strict";

const sinon = require("sinon");
const stream = require("stream");

const bunyanLogger = sinon.match({
  fatal: sinon.match.func,
  warn: sinon.match.func,
  info: sinon.match.func,
  debug: sinon.match.func,
  trace: sinon.match.func,
  child: sinon.match.func
});

describe("Endpoint", () => {
  let fakes, streams, Endpoint;

  beforeEach(() => {
    fakes = {
      tls: {
        connect: sinon.stub(),
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
      socket:       new stream.PassThrough(),
      connection:   new stream.PassThrough(),
      serializer:   new stream.PassThrough(),
      deserializer: new stream.PassThrough(),
      compressor:   new stream.PassThrough(),
      decompressor: new stream.PassThrough(),
    };

    // These streams should never actually pass writable -> readable 
    // otherwise the tests create an infinite loop. The real streams terminate.
    // PassThrough is just an easy way to inspect the stream behaviour.
    sinon.stub(streams.socket, "pipe");
    sinon.stub(streams.connection, "pipe");

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

  describe("connect", () => {
    describe("tls socket", () => {

      it("is created", () => {
        new Endpoint({});

        expect(fakes.tls.connect).to.be.calledOnce;
      });

      describe("connection parameters", () => {

        context("all supplied", () => {

          beforeEach(() => {
            new Endpoint({
              address: "localtest", host: "127.0.0.1", port: 443,
              pfx: "pfxData", cert: "certData",
              key: "keyData", passphrase: "p4ssphr4s3"
            });
          });

          it("includes the host and port and servername", () => {
            expect(fakes.tls.connect).to.be.calledWith(sinon.match({
              host: "127.0.0.1",
              port: 443,
              servername: "localtest"
            }));
          });

          it("includes the ALPNProtocols", () => {
            expect(fakes.tls.connect).to.be.calledWith(sinon.match({
              ALPNProtocols: ["h2"]
            }));
          });

          it("includes the credentials", () => {
            expect(fakes.tls.connect).to.be.calledWith(sinon.match({
              pfx: "pfxData",
              cert: "certData",
              key: "keyData",
              passphrase: "p4ssphr4s3"
            }));
          });
        });

        context("host is not omitted", () => {
            it("falls back on 'address'", () => {
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

      context("connection established", () => {
        it("writes the HTTP/2 prelude", () => {
          sinon.spy(streams.socket, "write");

          new Endpoint({});

          streams.socket.emit("secureConnect");

          const HTTP2_PRELUDE = new Buffer("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");

          expect(streams.socket.write.firstCall).to.be.calledWith(HTTP2_PRELUDE);
        });

        it("emits 'connect' event", () => {
          const endpoint = new Endpoint({});
          let connect = sinon.spy();

          endpoint.on("connect", connect);
          streams.socket.emit("secureConnect");
          expect(connect).to.be.calledOnce;
        });
      });

      it("bubbles error events", () => {
        const endpoint = new Endpoint({});
        const errorSpy = sinon.spy();
        endpoint.on("error", errorSpy);

        streams.socket.emit("error", "this should be bubbled");

        expect(errorSpy).to.have.been.calledWith("this should be bubbled");
      });
    });

    describe("HTTP/2 layer", () => {
      let endpoint;

      beforeEach(() => {
        endpoint = new Endpoint({});
      });

      describe("connection", () => {
        it("is created", () => {
          expect(fakes.protocol.Connection).to.have.been.calledWithNew;
          expect(fakes.protocol.Connection).to.have.been.calledOnce;
        });

        it("is passed the correct parameters", () => {

          // Empty bunyan logger
          expect(fakes.protocol.Connection).to.have.been.calledWith(bunyanLogger);

          // First stream ID
          expect(fakes.protocol.Connection).to.have.been.calledWith(sinon.match.any, 1);
        });

        it("bubbles error events", () => {
          const errorSpy = sinon.spy();
          endpoint.on("error", errorSpy);

          streams.connection.emit("error", "this should be bubbled");

          expect(errorSpy).to.have.been.calledWith("this should be bubbled");
        });
      });

      describe("serializer", () => {
        it("is created", () => {
          expect(fakes.protocol.Serializer).to.have.been.calledWithNew;
          expect(fakes.protocol.Serializer).to.have.been.calledOnce;
        });

        it("is passed the logger", () => {
          expect(fakes.protocol.Serializer).to.have.been.calledWith(bunyanLogger);
        });

        it("bubbles error events", () => {
          const errorSpy = sinon.spy();
          endpoint.on("error", errorSpy);

          streams.serializer.emit("error", "this should be bubbled");

          expect(errorSpy).to.have.been.calledWith("this should be bubbled");
        });
      });

      describe("deserializer", () => {
        it("is created", () => {
          expect(fakes.protocol.Deserializer).to.have.been.calledWithNew;
          expect(fakes.protocol.Deserializer).to.have.been.calledOnce;
        });

        it("is passed the logger", () => {
          expect(fakes.protocol.Deserializer).to.have.been.calledWith(bunyanLogger);
        });

        it("bubbles error events", () => {
          const errorSpy = sinon.spy();
          endpoint.on("error", errorSpy);

          streams.deserializer.emit("error", "this should be bubbled");

          expect(errorSpy).to.have.been.calledWith("this should be bubbled");
        });
      });

      describe("compressor", () => {
        it("is created", () => {
          expect(fakes.protocol.Compressor).to.have.been.calledWithNew;
          expect(fakes.protocol.Compressor).to.have.been.calledOnce;
        });

        it("is passed the correct parameters", () => {
          expect(fakes.protocol.Compressor).to.have.been.calledWith(bunyanLogger);
          expect(fakes.protocol.Compressor).to.have.been.calledWith(sinon.match.any, "REQUEST");
        });

        it("handles HEADER_TABLE_SIZE settings update", () => {
          streams.connection.emit("RECEIVING_SETTINGS_HEADER_TABLE_SIZE", 1000);
          expect(streams.compressor.setTableSizeLimit).to.have.been.calledWith(1000);
        });

        it("bubbles error events", () => {
          const errorSpy = sinon.spy();
          endpoint.on("error", errorSpy);

          streams.compressor.emit("error", "this should be bubbled");

          expect(errorSpy).to.have.been.calledWith("this should be bubbled");
        });
      });

      describe("decompressor", () => {
        it("is created", () => {
          expect(fakes.protocol.Decompressor).to.have.been.calledWithNew;
          expect(fakes.protocol.Decompressor).to.have.been.calledOnce;
        });

        it("is passed the correct parameters", () => {
          expect(fakes.protocol.Decompressor).to.have.been.calledWith(bunyanLogger);
          expect(fakes.protocol.Decompressor).to.have.been.calledWith(sinon.match.any, "RESPONSE");
        });

        it("handles HEADER_TABLE_SIZE settings acknowledgement", () => {
          streams.connection.emit("ACKNOWLEDGED_SETTINGS_HEADER_TABLE_SIZE", 1000);
          expect(streams.decompressor.setTableSizeLimit).to.have.been.calledWith(1000);
        });

        it("bubbles error events", () => {
          const errorSpy = sinon.spy();
          endpoint.on("error", errorSpy);

          streams.decompressor.emit("error", "this should be bubbled");

          expect(errorSpy).to.have.been.calledWith("this should be bubbled");
        });
      });
    });
  });

  describe("stream behaviour", () => {

    beforeEach(() => {
      sinon.stub(streams.serializer, "pipe");
      sinon.stub(streams.deserializer, "pipe");
      sinon.stub(streams.compressor, "pipe");
      sinon.stub(streams.decompressor, "pipe");

      sinon.spy(streams.socket, "write");

      new Endpoint({});
    });

    it("pipes the tls socket to the deserializer", () => {
      expect(streams.socket.pipe).to.be.calledWith(streams.deserializer);
      expect(streams.socket.pipe).to.be.calledAfter(streams.socket.write);
    });

    it("pipes the serializer to the tls socket", () => {
      expect(streams.serializer.pipe).to.be.calledWith(streams.socket);
      expect(streams.socket.pipe).to.be.calledAfter(streams.socket.write);
    });

    it("pipes the connection to the compressor", () => {
      expect(streams.connection.pipe).to.be.calledWith(streams.compressor);
    });

    it("pipes the compressor to the serializer", () => {
      expect(streams.compressor.pipe).to.be.calledWith(streams.serializer);
    });

    it("pipes the deserializer to the decompressor", () => {
      expect(streams.deserializer.pipe).to.be.calledWith(streams.decompressor);
    });

    it("pipes the decompressor to the connection", () => {
      expect(streams.decompressor.pipe).to.be.calledWith(streams.connection);
    });
  });

  describe("available stream slots", () => {
    let endpoint;

    beforeEach(() => {
      endpoint = new Endpoint({});
      streams.connection.createStream = sinon.stub().returns(new stream.PassThrough());

      expect(endpoint.availableStreamSlots).to.equal(0);
      streams.connection.emit("RECEIVING_SETTINGS_MAX_CONCURRENT_STREAMS", 5);
      expect(endpoint.availableStreamSlots).to.equal(5);
    });

    it("reflects the received settings value", () => {
      streams.connection.emit("RECEIVING_SETTINGS_MAX_CONCURRENT_STREAMS", 1024);
      expect(endpoint.availableStreamSlots).to.equal(1024);
    });

    it("reduces when a stream is created", () => {
      endpoint.createStream();
      expect(endpoint.availableStreamSlots).to.equal(4);
    });

    it("increases when a stream ends", () => {
      const stream = endpoint.createStream();

      stream.emit("end");
      expect(endpoint.availableStreamSlots).to.equal(5);
    });
  });


  describe("`wakeup` event", () => {

    context("when max concurrent streams limit updates", () => {
      it("emits", () => {
        const endpoint = new Endpoint({});
        const wakeupSpy = sinon.spy();
        endpoint.on("wakeup", wakeupSpy);

        streams.connection.emit("RECEIVING_SETTINGS_MAX_CONCURRENT_STREAMS", 5);

        expect(wakeupSpy).to.have.been.calledOnce;
      });
    });

    context("when stream ends", () => {
      it("emits", () => {
        const endpoint = new Endpoint({});
        const wakeupSpy = sinon.spy();
        endpoint.on("wakeup", wakeupSpy);

        streams.connection.createStream = sinon.stub().returns(new stream.PassThrough());
        endpoint.createStream().emit("end");

        expect(wakeupSpy).to.have.been.calledOnce;
      });
    });
  });

  describe("createStream", () => {
    let endpoint;

    beforeEach(() => {
      streams.connection.createStream = sinon.stub().returns(new stream.PassThrough());
      endpoint = new Endpoint({});
    });

    it("calls createStream on the connection", () => {
      endpoint.createStream();

      expect(streams.connection.createStream).to.have.been.calledOnce;
    });

    it("passes the return value from the connection", () => {
      let stream = endpoint.createStream();
      let connectionStream = streams.connection.createStream.firstCall.returnValue;

      expect(stream).to.deep.equal(connectionStream);
    });
  });

  describe("destroy", () => {
    let endpoint;

    beforeEach(() => {
      endpoint = new Endpoint({});
      streams.socket.destroy = sinon.stub();
    });

    it("destroys the underlying socket", () => {
      endpoint.destroy();

      expect(streams.socket.destroy).to.be.called.once;
    });
  });
});

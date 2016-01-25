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
        let endpoint = new Endpoint({});

        expect(fakes.tls.connect).to.be.calledOnce;
      });

      describe("connection parameters", () => {
        let connectParameters;

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
              let endpoint = new Endpoint({
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

      it("emits 'connect' event", () => {
        const endpoint = new Endpoint({});
        let connect = sinon.spy();

        endpoint.on("connect", connect);
        streams.socket.emit("secureConnect");
        expect(connect).to.be.calledOnce;
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
      beforeEach(() => {
        const endpoint = new Endpoint({});
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
      });

      describe("serializer", () => {
        it("is created", () => {
          expect(fakes.protocol.Serializer).to.have.been.calledWithNew;
          expect(fakes.protocol.Serializer).to.have.been.calledOnce;
        });

        it("is passed the logger", () => {
          expect(fakes.protocol.Serializer).to.have.been.calledWith(bunyanLogger);
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
      });

      describe("compressor", () => {
        it("is created", () => {
          expect(fakes.protocol.Compressor).to.have.been.calledWithNew;
          expect(fakes.protocol.Compressor).to.have.been.calledOnce;
        });

        it("is passed the correct parameters", () => {
          expect(fakes.protocol.Compressor).to.have.been.calledWith(bunyanLogger);
          expect(fakes.protocol.Compressor).to.have.been.calledWith(sinon.match.any, 'REQUEST');
        });
      });

      describe("decompressor", () => {
        it("is created", () => {
          expect(fakes.protocol.Decompressor).to.have.been.calledWithNew;
          expect(fakes.protocol.Decompressor).to.have.been.calledOnce;
        });

        it("is passed the correct parameters", () => {
          expect(fakes.protocol.Decompressor).to.have.been.calledWith(bunyanLogger);
          expect(fakes.protocol.Decompressor).to.have.been.calledWith(sinon.match.any, 'RESPONSE');
        });
      });
    });

    it("writes the HTTP/2 prelude", () => {
      const endpoint = new Endpoint({});
      const HTTP2_PRELUDE = 'PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n';

      expect(endpoint.read().toString()).to.equal(HTTP2_PRELUDE);
    });
  });

  describe("stream behaviour", () => {
    let endpoint;
    beforeEach(() => {
      sinon.stub(streams.socket, "pipe");
      sinon.stub(streams.connection, "pipe");
      sinon.stub(streams.serializer, "pipe");
      sinon.stub(streams.deserializer, "pipe");
      sinon.stub(streams.compressor, "pipe");
      sinon.stub(streams.decompressor, "pipe");
      
      endpoint = new Endpoint({});
      sinon.stub(endpoint, "pipe");
    });

    context("when tls is established", () => {
      beforeEach(() => {
        streams.socket.emit("secureConnect");
      });

      it("pipes the tls socket to itself", () => {
        expect(streams.socket.pipe).to.be.calledWith(endpoint);
      });

      it("pipes itself to the tls socket", () => {
        expect(endpoint.pipe).to.be.calledWith(streams.socket);
      });
    });

    // it("pipes the connection to the compressor", () => {
    //   expect(streams.connection.pipe).to.be.calledWith(streams.compressor);
    // });
  });

  describe("available slots", () => {
    context("before settings received from server", () => {
      it("defaults to zero");
    });

    context("when streams have been reserved", () => {
      it("reflects the number of remaining slots");
    });
  });

  it("bubbles error events", () => {
    const endpoint = new Endpoint({});
    const errorSpy = sinon.spy();
    endpoint.on("error", errorSpy);

    const connection = fakes.protocol.Connection.firstCall.returnValue;

    connection.emit("error", "this should be bubbled");

    expect(errorSpy.firstCall).to.have.been.calledWith("this should be bubbled");
  });
});

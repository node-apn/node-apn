"use strict";

let sinon = require("sinon");
let stream = require("stream");

describe("Endpoint", () => {
  let fakes, Endpoint, socket, connection;

  beforeEach(() => {
    fakes = {
      tls: {
        connect: sinon.stub(),
      },
      protocol: {
        Connection: sinon.stub(),
        Serializer: sinon.stub(),
        Deserializer: sinon.stub(),
        Compressor: sinon.stub(),
        Decompressor: sinon.stub(),
      },
    }

    socket = new stream.PassThrough()
    fakes.tls.connect.returns(socket);
    connection = new stream.PassThrough()
    fakes.protocol.Connection.returns(connection);

    Endpoint = require("../../lib/protocol/endpoint")(fakes);
  })

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
        socket.emit("secureConnect");
        expect(connect).to.be.calledOnce;
      });

      it("bubbles error events", () => {
        const endpoint = new Endpoint({});
        const errorSpy = sinon.spy();
        endpoint.on("error", errorSpy);

        const socket = fakes.tls.connect.firstCall.returnValue;

        socket.emit("error", "this should be bubbled");

        expect(errorSpy).to.have.been.calledWith("this should be bubbled");
      });
    });

    describe("HTTP/2 connection", () => {

      it("is created", () => {
        const endpoint = new Endpoint({});
        expect(fakes.protocol.Connection).to.have.been.calledWithNew;
        expect(fakes.protocol.Connection).to.have.been.calledOnce;
      });

      it("is passed the correct parameters", () => {
        const endpoint = new Endpoint({});

        // Empty bunyan logger
        expect(fakes.protocol.Connection).to.have.been.calledWith(sinon.match({
          fatal: sinon.match.func,
          warn: sinon.match.func,
          info: sinon.match.func,
          debug: sinon.match.func,
          trace: sinon.match.func,
          child: sinon.match.func
        }));

        // First stream ID
        expect(fakes.protocol.Connection).to.have.been.calledWith(sinon.match.any, 1);
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
  });

  describe("stream behaviour", () => {
    context("when tls is established", () => {
      let endpoint;

      beforeEach(() => {
        endpoint = new Endpoint({});
        sinon.stub(endpoint, "pipe");
        sinon.stub(socket, "pipe");

        socket.emit("secureConnect");
      });

      it("pipes the tls socket to itself", () => {
        expect(socket.pipe).to.be.calledWith(endpoint);
      });

      it("pipes itself to the tls socket", () => {
        expect(endpoint.pipe).to.be.calledWith(socket)
      });

      it("writes the HTTP/2 prelude", () => {
        const HTTP2_PRELUDE = 'PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n';

        expect(endpoint.read().toString()).to.equal(HTTP2_PRELUDE);
      });
    });
  });

  describe("available slots", () => {
    context("before settings received from server", () => {
      it("defaults to zero");
    });

    context("when streams have been reserved", () => {
      it("reflects the number of remaining slots");
    });
  });
});

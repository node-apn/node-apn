"use strict";

let sinon = require("sinon");
let stream = require("stream");

describe("Endpoint", () => {

  const fakes = {
    tls: {
      connect: sinon.stub(),
    },
    protocol: {
      Endpoint: sinon.stub(),
    },
  }

  const Endpoint = require("../../lib/protocol/endpoint")(fakes);

  describe("connect", () => {
    beforeEach(() => {
      fakes.tls.connect.returns(new stream.PassThrough());
      fakes.protocol.Endpoint.returns(new stream.PassThrough());
    });

    afterEach(() => {
      fakes.tls.connect.reset();
      fakes.protocol.Endpoint.reset();
    });

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

      it("bubbles error events", () => {
        const endpoint = new Endpoint({});
        const errorSpy = sinon.spy();
        endpoint.on("error", errorSpy);

        const socket = fakes.tls.connect.firstCall.returnValue;

        socket.emit("error", "this should be bubbled");

        expect(errorSpy).to.have.been.calledWith("this should be bubbled");
      });
    });

    describe("HTTP/2 Endpoint", () => {

      it("is created", () => {
        const endpoint = new Endpoint({});
        expect(fakes.protocol.Endpoint).to.have.been.calledWithNew;
      });

      it("is passed the correct parameters", () => {
        const endpoint = new Endpoint({});

        // Empty bunyan logger
        let logger = fakes.protocol.Endpoint.firstCall.args[0];
        expect(logger).to.have.property("fatal");
        expect(logger).to.have.property("error");
        expect(logger).to.have.property("warn");
        expect(logger).to.have.property("info");
        expect(logger).to.have.property("debug");
        expect(logger).to.have.property("trace");
        expect(logger).to.have.property("child");
        expect(logger.child()).to.equal(logger);

        expect(fakes.protocol.Endpoint.firstCall.args[1]).to.equal("CLIENT");
      });

      it("bubbles error events", () => {
        const endpoint = new Endpoint({});
        const errorSpy = sinon.spy();
        endpoint.on("error", errorSpy);

        const h2Endpoint = fakes.protocol.Endpoint.firstCall.returnValue;

        h2Endpoint.emit("error", "this should be bubbled");

        expect(errorSpy.firstCall).to.have.been.calledWith("this should be bubbled");
      });
    });

    describe("on secureConnect", () => {
      let socket;
      let h2Endpoint;

      beforeEach(() => {
        const endpoint = new Endpoint({});
        socket = fakes.tls.connect.firstCall.returnValue;
        h2Endpoint = fakes.protocol.Endpoint.firstCall.returnValue;
      });

      it("pipes the tls socket to the h2Endpoint", () => {
        let pipe = sinon.stub(socket, "pipe");

        socket.emit("secureConnect");

        expect(pipe).to.be.calledWith(h2Endpoint);
      });

      it("pipes the h2Endpoint to the tls socket", () => {
        let pipe = sinon.stub(h2Endpoint, "pipe");

        socket.emit("secureConnect");
        expect(pipe).to.be.calledWith(socket)
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

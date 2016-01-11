var rewire = require("rewire");
var Endpoint = rewire("../../lib/protocol/endpoint");

var http2 = require("http2");
var sinon = require("sinon");
var stream = require("stream");
var EventEmitter = require("events");

describe("Endpoint", () => {
  var tls = Endpoint.__get__("tls");
  var protocol = Endpoint.__get__("protocol");

  describe("module references", () => {
    describe("protocol", () => {
      it("is http2.protocol", () => {
        expect(protocol).to.equal(http2.protocol);
      });
    });

    describe("tls", () => {
      it("is the tls module", () => {
        expect(tls).to.equal(require('tls'));
      });
    });
  });

  describe("connect", () => {
    beforeEach(() => {
      sinon.stub(tls, "connect");
      tls.connect.returns(new stream.PassThrough());

      sinon.stub(protocol, "Endpoint");
      protocol.Endpoint.returns(new stream.PassThrough());
    });

    afterEach(() => {
      tls.connect.restore();
      protocol.Endpoint.restore()
    });

    describe("TLS socket", () => {

      it("is created", () => {
        var endpoint = new Endpoint({});

        expect(tls.connect).to.be.calledOnce;
      });

      describe("connection parameters", () => {
        var connectionParameters;

        beforeEach(() => {
          var endpoint = new Endpoint({
            address: "localtest", port: 443,
            pfx: "pfxData", cert: "certData",
            key: "keyData", passphrase: "p4ssphr4s3"
          });

          connectParameters = tls.connect.firstCall.args[0];
        });

        it("includes the host and port", () => {
          expect(connectParameters).to.have.property("host", "localtest")
          expect(connectParameters).to.have.property("port", 443);
        });

        context("host is not supplied", () => {
            it("falls back on 'address'");
        });

        it("includes the servername", () => {
          expect(connectParameters).to.have.property("servername", "localtest");
        });

        it("includes the ALPNProtocols", () => {
          expect(connectParameters.ALPNProtocols[0]).to.equal("h2");
        });

        it("includes the credentials", () => {
          expect(connectParameters).to.have.property("pfx", "pfxData");
          expect(connectParameters).to.have.property("cert", "certData");
          expect(connectParameters).to.have.property("key", "keyData");
          expect(connectParameters).to.have.property("passphrase", "p4ssphr4s3");
        });
      });

      it("bubbles error events", () => {
        var endpoint = new Endpoint({});

        var errorSpy = sinon.spy();
        endpoint.on("error", errorSpy);

        var socket = tls.connect.firstCall.returnValue;

        socket.emit("error", "this should be bubbled");

        expect(errorSpy.firstCall).to.have.been.calledWith("this should be bubbled");
      });
    });

    describe("HTTP/2 Endpoint", () => {

      it("is created", () => {
        var endpoint = new Endpoint({});
        expect(protocol.Endpoint).to.have.been.calledWithNew;
      });

      it("is passed the correct parameters", () => {
        var endpoint = new Endpoint({});

        // Empty bunyan logger
        var logger = protocol.Endpoint.firstCall.args[0];
        expect(logger).to.have.property("fatal");
        expect(logger).to.have.property("error");
        expect(logger).to.have.property("warn");
        expect(logger).to.have.property("info");
        expect(logger).to.have.property("debug");
        expect(logger).to.have.property("trace");
        expect(logger).to.have.property("child");
        expect(logger.child()).to.equal(logger);

        expect(protocol.Endpoint.firstCall.args[1]).to.equal("CLIENT");
      });

      it("bubbles error events", () => {
        var endpoint = new Endpoint({});

        var errorSpy = sinon.spy();
        endpoint.on("error", errorSpy);

        var h2Endpoint = protocol.Endpoint.firstCall.returnValue;

        h2Endpoint.emit("error", "this should be bubbled");

        expect(errorSpy.firstCall).to.have.been.calledWith("this should be bubbled");
      });
    });

    describe("on secureConnect", () => {
      var socket;
      var h2Endpoint;

      beforeEach(() => {
        new Endpoint({});
        socket = tls.connect.firstCall.returnValue;
        h2Endpoint = protocol.Endpoint.firstCall.returnValue;
      });

      it("pipes the tls socket to the h2Endpoint", () => {
        var pipe = sinon.stub(socket, "pipe");

        socket.emit("secureConnect");

        expect(pipe).to.be.calledWith(h2Endpoint);
      });

      it("pipes the h2Endpoint to the tls socket", () => {
        var pipe = sinon.stub(h2Endpoint, "pipe");

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

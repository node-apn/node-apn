var rewire = require("rewire");
var Endpoint = rewire("../lib/endpoint");

var http2 = require("http2");
var sinon = require("sinon");
var stream = require("stream");
var EventEmitter = require("events");

describe("Endpoint", () => {
  describe("module references", () => {
    describe("http2 protocol", () => {
      it("is http2.protocol", () => {
        var protocol = Endpoint.__get__("protocol");

        expect(protocol).to.equal(http2.protocol);
      });
    });

    describe("tls", () => {
      it("is the tls module", () => {
        var tls = Endpoint.__get__("tls");

        expect(tls).to.equal(require('tls'));
      });
    });
  });

  describe("connect", () => {
    var tls = Endpoint.__get__("tls");

    beforeEach(() => {
      sinon.stub(tls, "connect");
      tls.connect.returns(new EventEmitter());
    });

    afterEach(() => {
      tls.connect.restore();
    });

    it("creates a TLS socket", () => {
      var endpoint = new Endpoint({});

      expect(tls.connect).to.be.calledOnce;
    });

    it("retains the socket as an ivar", () => {
      var endpoint = new Endpoint({});

      expect(endpoint._socket).to.equal(tls.connect.firstCall.returnValue);
    });

    it("passes the connection parameters", () => {
      var endpoint = new Endpoint({address: "localtest", port: 443});

      var connectParameters = tls.connect.firstCall.args[0];

      expect(connectParameters).to.have.property("host", "localtest")
      expect(connectParameters).to.have.property("port", 443);
    });

    it("sets the servername", () => {
      var endpoint = new Endpoint({address: "localtest", port: 443});

      var connectParameters = tls.connect.firstCall.args[0];

      expect(connectParameters).to.have.property("servername", "localtest");
    });

    it("sets the ALPNProtocols", () => {
      var endpoint = new Endpoint({address: "localtest", port: 443});

      var connectParameters = tls.connect.firstCall.args[0];

      expect(connectParameters.ALPNProtocols[0]).to.equal("h2");
    });

    it("passes the credential parameters", () => {
      var endpoint = new Endpoint({
        address: "localtest", port: 443,
        pfx: "pfxData", cert: "certData",
        key: "keyData", passphrase: "p4ssphr4s3"
      });

      var connectParameters = tls.connect.firstCall.args[0];

      expect(connectParameters).to.have.property("pfx", "pfxData");
      expect(connectParameters).to.have.property("cert", "certData");
      expect(connectParameters).to.have.property("key", "keyData");
      expect(connectParameters).to.have.property("passphrase", "p4ssphr4s3");
    });

    describe("secureConnect event", () => {
      var endpoint;
      beforeEach(() => {
        endpoint = new Endpoint({});
        sinon.stub(endpoint, "_connected");

        var socket = tls.connect.firstCall.returnValue;

        socket.emit("secureConnect");
      });

      it("calls Endpoint#connected", () => {
        expect(endpoint._connected).to.be.calledOnce;
      });

      it("uses correct `this` value for Endpoint#connected", () => {
        expect(endpoint._connected.firstCall.thisValue).to.equal(endpoint);
      });
    });
  });

  describe("connected", () => {
    var endpoint;
    var protocol;

    before(() => {
      protocol = Endpoint.__get__("protocol");
    });

    beforeEach(() => {
      sinon.stub(protocol, "Endpoint");
      protocol.Endpoint.returns(new stream.PassThrough());

      sinon.stub(Endpoint.prototype, "_connect");
      endpoint = new Endpoint({});
      endpoint._socket = new stream.PassThrough();
    });

    afterEach(() => {
      Endpoint.prototype._connect.restore();
      protocol.Endpoint.restore()
    });

    it("creates an h2Endpoint", () => {
      endpoint._connected();

      expect(protocol.Endpoint).to.have.been.calledWithNew;
    });

    it("passes the correct parameters when creating the h2Endpoint", () => {
      endpoint._connected();

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

    it("retains the h2Endpoint as an ivar", () => {
      endpoint._connected();

      expect(endpoint._h2Endpoint).to.equal(protocol.Endpoint.firstCall.returnValue);
    });

    it("pipes the tls socket to the h2Endpoint", () => {
      var pipe = sinon.stub(endpoint._socket, "pipe");

      endpoint._connected();

      expect(pipe).to.be.calledWith(endpoint._h2Endpoint);
    });

    it("pipes the h2Endpoint to the tls socket", () => {
      var pipeSource;
      endpoint._socket.on("pipe", writer => pipeSource = writer);

      endpoint._connected();
      expect(pipeSource).to.equal(endpoint._h2Endpoint);
    });

    it("bubbles error events", () => {
      var errorSpy = sinon.spy();
      endpoint.on("error", errorSpy);

      endpoint._connected();
      endpoint._h2Endpoint.emit("error", "this should be bubbled");

      expect(errorSpy.firstCall).to.have.been.calledWith("this should be bubbled");
    });
  });
});

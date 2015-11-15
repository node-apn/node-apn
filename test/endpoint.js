var rewire = require("rewire");
var Endpoint = rewire("../lib/endpoint");

var http2 = require("http2");
var sinon = require("sinon");
var stream = require("stream");
var EventEmitter = require("events");

describe("Endpoint", () => {
  describe("module references", () => {
    describe("h2Endpoint", () => {
      it("is the constructor for http2.protocol.Endpoint", () => {
        var h2Endpoint = Endpoint.__get__("h2Endpoint");

        expect(h2Endpoint).to.equal(http2.protocol.Endpoint);
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
        sinon.stub(endpoint, "connected");

        var socket = tls.connect.firstCall.returnValue;

        socket.emit("secureConnect");
      });

      it("calls Endpoint#connected", () => {
        expect(endpoint.connected).to.be.calledOnce;
      });

      it("uses correct `this` value for Endpoint#connected", () => {
        expect(endpoint.connected.firstCall.thisValue).to.equal(endpoint);
      });
    });
  });

  describe("connected", () => {
    var endpoint;
    var h2Endpoint, h2EndpointSpy;

    before(() => {
      h2EndpointSpy = sinon.spy(stream.PassThrough);
      h2Endpoint = Endpoint.__set__("h2Endpoint", h2EndpointSpy);
    });

    after(() => {
      h2Endpoint()
    });

    beforeEach(() => {
      sinon.stub(Endpoint.prototype, "connect")
      endpoint = new Endpoint({});
      endpoint._socket = new stream.PassThrough();
    });

    afterEach(() => {
      Endpoint.prototype.connect.restore();
      h2EndpointSpy.reset()
    });

    it("creates an h2Endpoint", () => {
      endpoint.connected();

      expect(h2EndpointSpy).to.have.been.calledWithNew;
    });

    it("passes the correct parameters when creating the h2Endpoint", () => {
      endpoint.connected();

      // Empty bunyan logger
      expect(h2EndpointSpy.firstCall.args[0]).to.have.property("fatal");
      expect(h2EndpointSpy.firstCall.args[0]).to.have.property("error");
      expect(h2EndpointSpy.firstCall.args[0]).to.have.property("warn");
      expect(h2EndpointSpy.firstCall.args[0]).to.have.property("info");
      expect(h2EndpointSpy.firstCall.args[0]).to.have.property("debug");
      expect(h2EndpointSpy.firstCall.args[0]).to.have.property("trace");
      expect(h2EndpointSpy.firstCall.args[0]).to.have.property("child");

      expect(h2EndpointSpy.firstCall.args[1]).to.equal("CLIENT");
    });

    it("retains the h2Endpoint as an ivar", () => {
      endpoint.connected();

      expect(endpoint._h2Endpoint).to.equal(h2EndpointSpy.firstCall.returnValue);
    });

    it("pipes the tls socket to the h2Endpoint", () => {
      var pipe = sinon.stub(endpoint._socket, "pipe");

      endpoint.connected();

      expect(pipe).to.be.calledWith(endpoint._h2Endpoint);
    });

    it("pipes the h2Endpoint to the tls socket", () => {
      var pipeSource;
      endpoint._socket.on("pipe", writer => pipeSource = writer);

      endpoint.connected();
      expect(pipeSource).to.equal(endpoint._h2Endpoint);
    });

    it("bubbles error events", () => {
      var errorSpy = sinon.spy();
      endpoint.on("error", errorSpy);

      endpoint.connected();
      endpoint._h2Endpoint.emit("error", "this should be bubbled");

      expect(errorSpy.firstCall).to.have.been.calledWith("this should be bubbled");
    });
  });
});

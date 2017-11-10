"use strict";

const sinon = require("sinon");

describe("config", function () {
  let config, fakes;

  beforeEach(function() {
    fakes = {
      logger: sinon.spy(),
      prepareCertificate: sinon.stub(),
      prepareToken: sinon.stub(),
      prepareCA: sinon.stub(),
    };

    config = require("../lib/config")(fakes);
  });

  it("supplies sensible defaults", function () {
    expect(config()).to.deep.equal({
      token: null,
      cert: "cert.pem",
      key: "key.pem",
      ca: null,
      pfx: null,
      passphrase: null,
      production: false,
      address: "api.development.push.apple.com",
      port: 443,
      proxy: null,
      rejectUnauthorized: true,
      connectionRetryLimit: 10,
      heartBeat: 60000,
    });
  });

  describe("address configuration", function () {
    let originalEnv;

    before(function() {
      originalEnv = process.env.NODE_ENV;
    });

    after(function() {
      process.env.NODE_ENV = originalEnv;
    });

    beforeEach(function() {
      process.env.NODE_ENV = "";
    });

    it("should use api.sandbox.push.apple.com as the default connection address", function () {
      expect(config()).to.have.property("address", "api.development.push.apple.com");
    });

    it("should use api.push.apple.com when NODE_ENV=production", function () {
      process.env.NODE_ENV = "production";
      expect(config()).to.have.property("address", "api.push.apple.com");
    });

    it("should give precedence to production flag over NODE_ENV=production", function () {
      process.env.NODE_ENV = "production";
      expect(config({ production: false })).to.have.property("address", "api.development.push.apple.com");
    });

    it("should use api.push.apple.com when production:true", function () {
      expect(config({production:true})).to.have.property("address", "api.push.apple.com");
    });

    it("should use a custom address when passed", function () {
      expect(config({address: "testaddress"})).to.have.property("address", "testaddress");
    });

    describe("address is passed", function() {
      it("sets production to true when using production address", function() {
        expect(config({address: "api.push.apple.com"})).to.have.property("production", true);
      });

      it("sets production to false when using sandbox address", function() {
        process.env.NODE_ENV = "production";
        expect(config({address: "api.sandbox.push.apple.com"})).to.have.property("production", false);
      });
    });
  });

  describe("credentials", function () {

    context("`token` not supplied, use certificate", function () {
      describe("passphrase", function () {
        it("throws an error when supplied passphrase is not a string", function () {
          expect(() => config({ passphrase: 123 }) ).to.throw("Passphrase must be a string");
        });

        it("does not throw when passphrase is a string", function () {
          expect(() => config({ passphrase: "seekrit" }) ).to.not.throw();
        });

        it("does not throw when passphrase is not supplied", function () {
          expect(() => config({ }) ).to.not.throw();
        });
      });

      context("pfx value is supplied without cert and key", function () {
        it("includes the value of `pfx`", function () {
          expect(config( { pfx: "apn.pfx" } )).to.have.property("pfx", "apn.pfx");
        });

        it("does not include a value for `cert`", function () {
          expect(config( { pfx: "apn.pfx" }).cert).to.be.undefined;
        });

        it("does not include a value for `key`", function () {
          expect(config( { pfx: "apn.pfx" }).key).to.be.undefined;
        });
      });

      context("pfx value is supplied along with a cert and key", function () {
        it("includes the value of `pfx`", function () {
          expect(config( { pfx: "apn.pfx", cert: "cert.pem", key: "key.pem" } )).to.have.property("pfx", "apn.pfx");
        });

        it("does not include a value for `cert`", function () {
          expect(config( { pfx: "apn.pfx", cert: "cert.pem", key: "key.pem" })).to.have.property("cert", "cert.pem");
        });

        it("does not include a value for `key`", function () {
          expect(config( { pfx: "apn.pfx", cert: "cert.pem", key: "key.pem" })).to.have.property("key", "key.pem");
        });
      });

      context("pfxData value is supplied without cert and key", function () {
        it("includes the value of `pfxData`", function () {
          expect(config( { pfxData: "apnData" } )).to.have.property("pfxData", "apnData");
        });

        it("does not include a value for `cert`", function () {
          expect(config( { pfxData: "apnData" } ).cert).to.be.undefined;
        });

        it("does not include a value for `key`", function () {
          expect(config( { pfxData: "apnData" }).key).to.be.undefined;
        });
      });

      context("pfxData value is supplied along with a cert and key", function () {
        it("includes the value of `pfxData`", function () {
          expect(config( { pfxData: "apnData", cert: "cert.pem", key: "key.pem" } )).to.have.property("pfxData", "apnData");
        });

        it("does not include a value for `cert`", function () {
          expect(config( { pfxData: "apnData", cert: "cert.pem", key: "key.pem" })).to.have.property("cert", "cert.pem");
        });

        it("does not include a value for `key`", function () {
          expect(config( { pfxData: "apnData", cert: "cert.pem", key: "key.pem" })).to.have.property("key", "key.pem");
        });
      });

      it("loads and validates the TLS credentials", function () {
        fakes.prepareCertificate.returns({"cert": "certData", "key": "keyData", "pfx": "pfxData"});

        let configuration = config({});
        expect(configuration).to.have.property("cert", "certData");
        expect(configuration).to.have.property("key", "keyData");
        expect(configuration).to.have.property("pfx", "pfxData");
      });

      it("prepares the CA certificates", function () {
        fakes.prepareCA.returns({ ca: "certificate1" });

        let configuration = config({});
        expect(configuration).to.have.property("ca", "certificate1");
      });
    });

    context("`token` supplied", function () {
      const key = "testKey";
      const keyId = "abckeyId";
      const teamId = "teamId123";

      // Clear these to ensure tls.Socket doesn't attempt to do client-auth
      it("clears the `pfx` property", function () {
        expect(config( { token: { key, keyId, teamId } })).to.not.have.property("pfx");
      });

      it("clears the `key` property", function () {
        expect(config( { token: { key, keyId, teamId } })).to.not.have.property("key");
      });

      it("clears the `cert` property", function () {
        expect(config( { token: { key, keyId, teamId } })).to.not.have.property("cert");
      });

      describe("token", function () {

        it("throws an error if keyId is missing", function () {
          expect(() => config({ token: { key, teamId } })).to.throw(/token\.keyId is missing/);
        });

        it("throws an error if keyId is not a string", function () {
          expect(() => config({ token: { key, teamId, keyId: 123 }})).to.throw(/token\.keyId must be a string/);
        });

        it("throws an error if teamId is missing", function () {
          expect(() => config({ token: { key, keyId }})).to.throw(/token\.teamId is missing/);
        });

        it("throws an error if teamId is not a string", function () {
          expect(() => config({ token: { key, keyId, teamId: 123 }})).to.throw(/token\.teamId must be a string/);
        });
      });

      it("does not invoke prepareCertificate", function () {
        let configuration = config({ token: { key, keyId, teamId } });

        expect(fakes.prepareCertificate).to.have.not.been.called;
      });

      it("prepares a token generator", function () {
        let testConfig = { key, keyId, teamId };

        fakes.prepareToken
          .withArgs(sinon.match(testConfig))
          .returns( () => "fake-token" );

        let configuration = config({ token: testConfig });
        expect(fakes.prepareToken).to.have.been.called;
        expect(configuration.token()).to.equal("fake-token");
      });

      it("prepares the CA certificates", function () {
        fakes.prepareCA.returns({ ca: "certificate1" });

        let configuration = config({});
        expect(configuration).to.have.property("ca", "certificate1");
      });
    });
  });

  context("a null config value is passed", function () {
    it("should log a message with `debug`", function () {
      config( { address: null } );

      expect(fakes.logger).to.be.calledWith("Option [address] is null. This may cause unexpected behaviour.");
    });
  });

  context("a config value is undefined", function () {
    it("should log a message with `debug`", function () {
      config( { anOption: undefined } );

      expect(fakes.logger).to.be.calledWith("Option [anOption] is undefined. This may cause unexpected behaviour.");
    });
  });
});

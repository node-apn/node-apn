"use strict";

const sinon = require("sinon");

describe("config", () => {
  let config, fakes;

  beforeEach(function() {
    fakes = {
      debug: sinon.spy(),
      prepareCredentials: sinon.stub(),
    };

    config = require("../lib/config")(fakes);
  });

  it("supplies sensible defaults", () => {
    expect(config()).to.deep.equal({
      cert: "cert.pem",
      key: "key.pem",
      ca: null,
      pfx: null,
      passphrase: null,
      production: false,
      address: "api.sandbox.push.apple.com",
      port: 443,
      rejectUnauthorized: true,
      connectTimeout: 10000,
      connectionTimeout: 3600000,
      connectionRetryLimit: 10,
    });
  });

  describe("address configuration", () => {
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
      expect(config()).to.have.property("address", "api.sandbox.push.apple.com");
    });

    it("should use api.push.apple.com when NODE_ENV=production", function () {
      process.env.NODE_ENV = "production";
      expect(config()).to.have.property("address", "api.push.apple.com");
    });

    it("should give precedence to production flag over NODE_ENV=production", function () {
      process.env.NODE_ENV = "production";
      expect(config({ production: false })).to.have.property("address", "api.sandbox.push.apple.com");
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

  describe("credentials", () => {

    describe("passphrase", () => {
      it("throws an error when supplied passphrase is not a string", () => {
        expect(() => { config( { passphrase: 123 }) } ).to.throw("Passphrase must be a string");
      });

      it("does not throw when passphrase is a string", () => {
        expect(() => { config( { passphrase: "seekrit" }) } ).to.not.throw();
      });

      it("does not throw when passphrase is not supplied", () => {
        expect(() => { config( { }) } ).to.not.throw();
      });
    });

    context("pfx value is supplied without cert and key", () => {
      it("includes the value of `pfx`", () => {
        expect(config( { pfx: "apn.pfx" } )).to.have.property("pfx", "apn.pfx");
      });

      it("does not include a value for `cert`", () => {
        expect(config( { pfx: "apn.pfx" }).cert).to.be.undefined;
      });

      it("does not include a value for `key`", () => {
        expect(config( { pfx: "apn.pfx" }).key).to.be.undefined;
      });
    });

    context("pfx value is supplied along with a cert and key", () => {
      it("includes the value of `pfx`", () => {
        expect(config( { pfx: "apn.pfx", cert: "cert.pem", key: "key.pem" } )).to.have.property("pfx", "apn.pfx");
      });

      it("does not include a value for `cert`", () => {
        expect(config( { pfx: "apn.pfx", cert: "cert.pem", key: "key.pem" })).to.have.property("cert", "cert.pem");
      });

      it("does not include a value for `key`", () => {
        expect(config( { pfx: "apn.pfx", cert: "cert.pem", key: "key.pem" })).to.have.property("key", "key.pem");
      });
    });

    context("pfxData value is supplied without cert and key", () => {
      it("includes the value of `pfxData`", () => {
        expect(config( { pfxData: "apnData" } )).to.have.property("pfxData", "apnData");
      });

      it("does not include a value for `cert`", () => {
        expect(config( { pfxData: "apnData" } ).cert).to.be.undefined;
      });

      it("does not include a value for `key`", () => {
        expect(config( { pfxData: "apnData" }).key).to.be.undefined;
      });
    });

    context("pfxData value is supplied along with a cert and key", () => {
      it("includes the value of `pfxData`", () => {
        expect(config( { pfxData: "apnData", cert: "cert.pem", key: "key.pem" } )).to.have.property("pfxData", "apnData");
      });

      it("does not include a value for `cert`", () => {
        expect(config( { pfxData: "apnData", cert: "cert.pem", key: "key.pem" })).to.have.property("cert", "cert.pem");
      });

      it("does not include a value for `key`", () => {
        expect(config( { pfxData: "apnData", cert: "cert.pem", key: "key.pem" })).to.have.property("key", "key.pem");
      });
    });

    it("loads and validates the credentials", () => {
      fakes.prepareCredentials.returns({"cert": "certData", "key": "keyData", "pfx": "pfxData"});

      let configuration = config({});
      expect(configuration).to.have.property("cert", "certData");
      expect(configuration).to.have.property("key", "keyData");
      expect(configuration).to.have.property("pfx", "pfxData");
    });
  });

  context("a null config value is passed", () => {
    it("should log a message with `debug`", () => {
      config( { address: null } );

      expect(fakes.debug).to.be.calledWith("Option [address] is null. This may cause unexpected behaviour.");
    });
  });

  context("a config value is undefined", () => {
    it("should log a message with `debug`", () => {
      config( { anOption: undefined } );

      expect(fakes.debug).to.be.calledWith("Option [anOption] is undefined. This may cause unexpected behaviour.");
    });
  });
});

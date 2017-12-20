"use strict";

const sinon = require("sinon");

describe("perpareCertificate", function () {
  let fakes, prepareCertificate;

  beforeEach(function () {
    fakes = {
      load: sinon.stub(),
      parse: sinon.stub(),
      validate: sinon.stub(),
      logger: sinon.stub(),
    };

    prepareCertificate = require("../../../lib/credentials/certificate/prepare")(fakes);
  });

  describe("with valid credentials", function() {
    let credentials;
    const testOptions = {
      pfx: "myCredentials.pfx",
      cert: "myCert.pem",
      key: "myKey.pem",
      ca: "myCa.pem",
      passphrase: "apntest",
      production: true,
    };

    beforeEach(function() {
      fakes.load.withArgs(sinon.match(testOptions)).returns(
        {
          pfx: "myPfxData",
          cert: "myCertData",
          key: "myKeyData",
          ca: ["myCaData"],
          passphrase: "apntest",
        }
      );

      fakes.parse.returnsArg(0);
      credentials = prepareCertificate(testOptions);
    });

    describe("the validation stage", function() {
      it("is called once", function() {
        expect(fakes.validate).to.be.calledOnce;
      });

      it("is passed the production flag", function() {
        expect(fakes.validate.getCall(0).args[0]).to.have.property("production", true);
      });

      describe("passed credentials", function() {
        it("contains the PFX data", function() {
          expect(fakes.validate.getCall(0).args[0]).to.have.property("pfx", "myPfxData");
        });

        it("contains the key data", function() {
          expect(fakes.validate.getCall(0).args[0]).to.have.property("key", "myKeyData");
        });

        it("contains the certificate data", function() {
          expect(fakes.validate.getCall(0).args[0]).to.have.property("cert", "myCertData");
        });

        it("includes passphrase", function() {
          expect(fakes.validate.getCall(0).args[0]).to.have.property("passphrase", "apntest");
        });
      });
    });

    describe("resolution value", function() {

      it("contains the PFX data", function() {
        return expect(credentials).to.have.property("pfx", "myPfxData");
      });

      it("contains the key data", function() {
        return expect(credentials).to.have.property("key", "myKeyData");
      });

      it("contains the certificate data", function() {
        return expect(credentials).to.have.property("cert", "myCertData");
      });

      it("contains the CA data", function() {
        return expect(credentials).to.have.nested.property("ca[0]", "myCaData");
      });

      it("includes passphrase", function() {
        return expect(credentials).to.have.property("passphrase", "apntest");
      });
    });
  });

  describe("credential file cannot be parsed", function() {
    beforeEach(function() {
      fakes.load.returns({ cert: "myCertData", key: "myKeyData" });
      fakes.parse.throws(new Error("unable to parse key"));
    });

    it("should resolve with the credentials", function() {
      let credentials = prepareCertificate({ cert: "myUnparseableCert.pem", key: "myUnparseableKey.pem", production: true });
      return expect(credentials).to.deep.equal({ cert: "myCertData", key: "myKeyData" });
    });

    it("should log an error", function() {
      prepareCertificate({ cert: "myUnparseableCert.pem", key: "myUnparseableKey.pem" });

      expect(fakes.logger).to.be.calledWith(sinon.match(function(err) {
          return err.message ? err.message.match(/unable to parse key/) : false;
        }, "\"unable to parse key\""));
    });

    it("should not attempt to validate", function() {
      prepareCertificate({ cert: "myUnparseableCert.pem", key: "myUnparseableKey.pem" });
      expect(fakes.validate).to.not.be.called;
    });
  });

  describe("credential validation fails", function() {
    it("should throw", function() {
      fakes.load.returns(Promise.resolve({ cert: "myCertData", key: "myMismatchedKeyData" }));
      fakes.parse.returnsArg(0);
      fakes.validate.throws(new Error("certificate and key do not match"));

      return expect(() => prepareCertificate({ cert: "myCert.pem", key: "myMistmatchedKey.pem" })).to.throw(/certificate and key do not match/);
    });
  });

  describe("credential file cannot be loaded", function() {
    it("should throw", function() {
      fakes.load.throws(new Error("ENOENT, no such file or directory"));

      return expect(() => prepareCertificate({ cert: "noSuchFile.pem", key: "myKey.pem" })).to.throw("ENOENT, no such file or directory");
    });
  });
});

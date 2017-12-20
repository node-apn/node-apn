"use strict";

const sinon = require("sinon");

const APNCertificate = require("../../../lib/credentials/certificate/APNCertificate");
const APNKey = require("../../../lib/credentials/certificate/APNKey");

describe("parseCredentials", function() {
  let fakes, parseCredentials;

  const pfxKey = new APNKey({n: 1, e: 1 });
  const pfxCert = new APNCertificate({publicKey: {}, validity: {}, subject: {} });

  const pemKey = new APNKey({n: 2, e: 1 });
  const pemCert = new APNCertificate({publicKey: {}, validity: {}, subject: {} });

  beforeEach(function() {
    fakes = {
      parsePkcs12: sinon.stub(),
      parsePemKey: sinon.stub(),
      parsePemCert: sinon.stub(),
    };

    fakes.parsePemKey.withArgs("pemkey").returns(pemKey);

    fakes.parsePemKey.withArgs("pemcert").returns(pemCert);

    parseCredentials = require("../../../lib/credentials/certificate/parse")(fakes);
  });

  describe("with PFX file", function() {
    it("returns the parsed key", function() {
      fakes.parsePkcs12.withArgs("pfxData").returns({ key: pfxKey, certificates: [pfxCert] });

      const parsed = parseCredentials({ pfx: "pfxData" });
      expect(parsed.key).to.be.an.instanceof(APNKey);
    });

    it("returns the parsed certificates", function() {
      fakes.parsePkcs12.withArgs("pfxData").returns({ key: pfxKey, certificates: [pfxCert] });

      const parsed = parseCredentials({ pfx: "pfxData" });
      expect(parsed.certificates[0]).to.be.an.instanceof(APNCertificate);
    });

    describe("having passphrase", function() {
      beforeEach(function() {
        fakes.parsePkcs12.withArgs("encryptedPfxData", "apntest").returns({ key: pfxKey, certificates: [pfxCert] });
        fakes.parsePkcs12.withArgs("encryptedPfxData", sinon.match((value) => {return value !== "apntest"})).throws(new Error("unable to read credentials, incorrect passphrase"));
      });

      it("returns the parsed key", function() {
        const parsed = parseCredentials({ pfx: "encryptedPfxData", passphrase: "apntest" });
        expect(parsed.key).to.be.an.instanceof(APNKey);
      });

      it("throws when passphrase is incorrect", function() {
        expect(function() {
          parseCredentials({ pfx: "encryptedPfxData", passphrase: "incorrectpassphrase" });
        }).to.throw(/incorrect passphrase/);
      });

      it("throws when passphrase is not supplied", function() {
        expect(function() {
          parseCredentials({ pfx: "encryptedPfxData" });
        }).to.throw(/incorrect passphrase/);
      });
    });
  });

  describe("with PEM key", function() {
    it("returns the parsed key", function() {
      fakes.parsePemKey.withArgs("pemKeyData").returns(pemKey);

      const parsed = parseCredentials({ key: "pemKeyData" });
      expect(parsed.key).to.be.an.instanceof(APNKey);
    });

    describe("having passphrase", function() {
      beforeEach(function() {
        fakes.parsePemKey.withArgs("encryptedPemKeyData", "apntest").returns(pemKey);
        fakes.parsePemKey.withArgs("encryptedPemKeyData", sinon.match((value) => {return value !== "apntest"})).throws(new Error("unable to load key, incorrect passphrase"));
      });

      it("returns the parsed key", function() {
        const parsed = parseCredentials({ key: "encryptedPemKeyData", passphrase: "apntest" });
        expect(parsed.key).to.be.an.instanceof(APNKey);
      });

      it("throws when passphrase is incorrect", function() {
        expect(function() {
          parseCredentials({ key: "encryptedPemKeyData", passphrase: "incorrectpassphrase" });
        }).to.throw(/incorrect passphrase/);
      });

      it("throws when passphrase is not supplied", function() {
        expect(function() {
          parseCredentials({ key: "encryptedPemKeyData" });
        }).to.throw(/incorrect passphrase/);
      });
    });
  });

  describe("with PEM certificate", function() {
    it("returns the parsed certificate", function() {
      fakes.parsePemCert.withArgs("pemCertData").returns([pemCert]);

      const parsed = parseCredentials({ cert: "pemCertData" });
      expect(parsed.certificates[0]).to.be.an.instanceof(APNCertificate);
    });
  });

  describe("both PEM and PFX data is supplied", function() {
    it("it prefers PFX to PEM", function() {
      fakes.parsePkcs12.withArgs("pfxData").returns({ key: pfxKey, certificates: [pfxCert] });
      fakes.parsePemKey.withArgs("pemKeyData").returns(pemKey);
      fakes.parsePemCert.withArgs("pemCertData").returns([pemCert]);

      const parsed = parseCredentials({ pfx: "pfxData", key: "pemKeyData", cert: "pemCertData"});
      expect(parsed.key).to.equal(pfxKey);
      expect(parsed.certificates[0]).to.equal(pfxCert);
    });
  });
});

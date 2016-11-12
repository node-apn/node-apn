"use strict";

const APNKey = require("../../../lib/credentials/certificate/APNKey");
const forge = require("node-forge");
const fs = require("fs");

describe("APNKey", function() {
  it("initialises with a node-forge public key", function() {
    expect(new APNKey({ n: 12345, e: 65536})).to.be.an.instanceof(APNKey);
  });

  describe("throws", function() {
    it("missing modulus", function() {
      expect(function() {
        new APNKey({ e: 65536 });
      }).to.throw("key is not a valid public key");
    });

    it("missing exponent", function() {
      expect(function() {
        new APNKey({ n: 12345 });
      }).to.throw("key is not a valid public key");
    });

    it("undefined", function() {
      expect(function() {
        new APNKey();
      }).to.throw("key is not a valid public key");
    });
  });

  describe("fingerprint", function() {
    it("returns the fingerprint of the public key", function() {
      let keyPem = fs.readFileSync("test/credentials/support/key.pem");
      let apnKey = new APNKey(forge.pki.decryptRsaPrivateKey(keyPem));
      expect(apnKey.fingerprint()).to.equal("2d594c9861227dd22ba5ae37cc9354e9117a804d");
    });
  });
});

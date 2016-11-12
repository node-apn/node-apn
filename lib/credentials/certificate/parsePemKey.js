"use strict";

const forge = require("node-forge");

const APNKey = require("./APNKey");

function findAndDecryptKey(pemMessages, passphrase) {
  let apnKey = null;
  pemMessages.forEach(function(message) {
    if (!message.type.match(/KEY/)) {
      return;
    }

    let key = forge.pki.decryptRsaPrivateKey(forge.pem.encode(message), passphrase);

    if(!key) {
      if ((message.procType && message.procType.type === "ENCRYPTED") || message.type.match(/ENCRYPTED/)) {
        throw new Error("unable to parse key, incorrect passphrase");
      }
    }
    else if(apnKey) {
      throw new Error("multiple keys found in PEM file");
    }
    else {
      apnKey = new APNKey(key);
    }
  });
  return apnKey;
}

function apnKeyFromPem(keyPem, passphrase) {
  if (!keyPem) {
    return null;
  }

  try {
    let pemMessages = forge.pem.decode(keyPem);
    let apnKey = findAndDecryptKey(pemMessages, passphrase);
    if (apnKey) {
      return apnKey;
    }
  }
  catch (e) {
    if (e.message.match(/Unsupported OID/)) {
      throw new Error("unable to parse key, unsupported format: " + e.oid);
    }
    else if(e.message.match(/Invalid PEM formatted message/)) {
      throw new Error("unable to parse key, not a valid PEM file");
    }
    else if (e.message.match(/multiple keys/)) {
      throw e;
    }
    else if (e.message.match(/unable to parse key/)) {
      throw e;
    }
  }
  throw new Error("unable to parse key, no private key found");
}

module.exports = apnKeyFromPem;

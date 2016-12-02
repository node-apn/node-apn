"use strict";

module.exports = function (dependencies) {
  const logger = dependencies.logger;

  const resolve = require("./resolve");

  const parseCertificate = require("./certificate/parse")({
    parsePkcs12:  require("./certificate/parsePkcs12"),
    parsePemKey:  require("./certificate/parsePemKey"),
    parsePemCert: require("./certificate/parsePemCertificate"),
  });

  const loadCertificate = require("./certificate/load")({
    resolve
  });

  const prepareCertificate = require("./certificate/prepare")({
    load: loadCertificate,
    parse: parseCertificate,
    validate: require("./certificate/validate"),
    logger: logger,
  });

    const sign = require("jsonwebtoken/sign");
    const decode = require("jsonwebtoken/decode");

  const prepareToken = require("./token/prepare")({
    sign,
    resolve,
    decode
  });

  const prepareCA = require("./ca/prepare")({
    resolve,
  });

  return {
    certificate: prepareCertificate,
    token: prepareToken,
    ca: prepareCA,
  };
};

"use strict";

const VError = require("verror");

module.exports = function (dependencies) {
  const sign = dependencies.sign;
  const resolve = dependencies.resolve;

  function prepareToken(options) {
    try {
        let keyData = resolve(options.key);

        return function () {
            return sign({}, keyData, { algorithm: "ES256", issuer: options.teamId, header: { kid: options.keyId }});
        };
    } catch (err) {
        throw new VError(err, "Failed loading token key");
    }
  }

  return prepareToken;
};

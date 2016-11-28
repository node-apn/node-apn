"use strict";

const VError = require("verror");

module.exports = function (dependencies) {
  const sign = dependencies.sign;
  const decode = dependencies.decode;
  const resolve = dependencies.resolve;

  function prepareToken(options) {
    let keyData;
    try {
      keyData = resolve(options.key);
    } catch (err) {
      throw new VError(err, "Failed loading token key");
    }

    try {
      let token = sign.bind(null, {}, keyData, {
        algorithm: "ES256", 
        issuer: options.teamId, 
        header: { kid: options.keyId }
      });

      return {
        generation: 0,
        current: token(),
        iat: null,
        regenerate(generation) {
          if (generation === this.generation) {
            this.generation += 1;
            this.current = token();
            this.iat = null;
          }
        },
        isExpired(validSeconds) {
          if (this.iat == null) {
            let decoded = decode(this.current);
            this.iat = decoded.iat;
          }
          return (Math.floor(Date.now() / 1000) - this.iat) >= validSeconds;
        }
      };
    } catch (err) {
      throw new VError(err, "Failed to generate token");
    }
  }

  return prepareToken;
};

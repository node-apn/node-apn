"use strict";

const VError = require("verror");

module.exports = function (dependencies) {
  const sign = dependencies.sign;
  const resolve = dependencies.resolve;

  function prepareToken(options) {
    try {
        let keyData = resolve(options.key);

        let token = sign.bind(null, {}, keyData, {
          algorithm: "ES256", 
          issuer: options.teamId, 
          header: { kid: options.keyId }
        });
        
        return {
          generation: 0,
          current: token(),
          regenerate: function (generation) {
            if (generation === this.generation) {
              this.generation += 1;
              this.current = token();
            }
          }
        }
    } catch (err) {
        throw new VError(err, "Failed loading token key");
    }
  }

  return prepareToken;
};

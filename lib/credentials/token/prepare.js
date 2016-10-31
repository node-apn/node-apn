"use strict";

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var VError = require("verror");

module.exports = function (dependencies) {
  var sign = dependencies.sign;
  var resolve = dependencies.resolve;

  function prepareToken(options) {
    var keyData = void 0;
    try {
      keyData = resolve(options.key);
    } catch (err) {
      throw new VError(err, "Failed loading token key");
    }

    try {
      var _ret = function () {
        var token = sign.bind(null, {}, keyData, {
          algorithm: "ES256",
          issuer: options.teamId,
          header: { kid: options.keyId }
        });

        return {
          v: {
            generation: 0,
            current: token(),
            regenerate: function regenerate(generation) {
              if (generation === this.generation) {
                this.generation += 1;
                this.current = token();
              }
            }
          }
        };
      }();

      if ((typeof _ret === "undefined" ? "undefined" : _typeof(_ret)) === "object") return _ret.v;
    } catch (err) {
      throw new VError(err, "Failed to generate token");
    }
  }

  return prepareToken;
};
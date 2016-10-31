"use strict";

module.exports = function (dependencies) {
  var load = dependencies.load;
  var parse = dependencies.parse;
  var validate = dependencies.validate;

  var logger = dependencies.logger;

  function loadAndValidate(credentials) {
    var loaded = load(credentials);
    var parsed = void 0;
    try {
      parsed = parse(loaded);
    } catch (err) {
      logger(err);
      return loaded;
    }
    parsed.production = credentials.production;
    validate(parsed);
    return loaded;
  }

  return loadAndValidate;
};
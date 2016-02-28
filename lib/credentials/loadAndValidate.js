"use strict";

module.exports = function(dependencies) {
  const load = dependencies.load;
  const parse = dependencies.parse;
  const validate = dependencies.validate;

  function loadAndValidate(credentials) {
    const loaded = load(credentials);
    let parsed;
    try {
      parsed = parse(loaded);
    } catch(err) {
      return loaded;
    }
    parsed.production = credentials.production;
    validate(parsed);
    return loaded;
  }

  return loadAndValidate;
};

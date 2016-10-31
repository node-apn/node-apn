"use strict";

module.exports = function (dependencies) {
  var resolve = dependencies.resolve;

  function prepareCA(credentials) {
    // Prepare Certificate Authority data if available.
    var ca = [];

    if (credentials.ca !== null) {
      if (!Array.isArray(credentials.ca)) {
        credentials.ca = [credentials.ca];
      }
      ca = credentials.ca.map(resolve);
    }
    if (ca.length === 0) {
      ca = undefined;
    }

    return { ca: ca };
  }

  return prepareCA;
};
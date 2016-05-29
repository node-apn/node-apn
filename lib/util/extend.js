"use strict";

module.exports = function extend(target, source) {
  for (var key in source) {
    if (source[key] !== undefined) {
      target[key] = source[key];
    }
  }
  return target;
};

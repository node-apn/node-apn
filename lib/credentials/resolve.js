"use strict";

const fs = require("fs");

function resolveCredential(value) {
  if (!value) {
    return value;
  }
  if(/-----BEGIN ([A-Z\s*]+)-----/.test(value)) {
    return value;
  }
  else if(Buffer.isBuffer(value)) {
    return value;
  }
  else {
    return fs.readFileSync(value);
  }
}

module.exports = resolveCredential;

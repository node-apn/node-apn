"use strict";
/**
 * Validates a device token
 *
 * Will convert to string and removes invalid characters as required.
 */
function token(input) {
  let token;
  
  if (typeof input === "string") {
    token = input;
  } else if (Buffer.isBuffer(input)) {
    token = input.toString("hex");
  }

  token = token.replace(/[^0-9a-f]/gi, "");

  if (token.length === 0) {
    throw new Error("Token has invalid length");
  }

  return token;
}

module.exports = token;

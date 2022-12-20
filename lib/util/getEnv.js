"use strict";

/**
 * Get environment variable regardless of casing (upper/lowercase).
 * @param {string} key - Name of the environment variable
 * @returns {string} Value of the environment variable or empty string
 */
module.exports = function getEnv(key) {
  if (!process || !process.env) return '';
  return process.env[key.toUpperCase()] || process.env[key.toLowerCase()] || '';
};

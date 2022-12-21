"use strict";

const getEnv = require("../../util/getEnv");

/**
 * Checks the `no_proxy` environment variable if a hostname (and port) should be proxied or not.
 * 
 * @param {string} hostname - Hostname of the page we are connecting to (not the proxy itself)
 * @param {string} port - Effective port number for the host
 * @returns {boolean} Whether the hostname should be proxied or not
 */
module.exports = function shouldProxy(hostname, port) {
  const noProxy = `${getEnv("no_proxy") || getEnv("npm_config_no_proxy")}`.toLowerCase();
  if (!noProxy || noProxy === "*") return true; // No proxy restrictions are set or everything should be proxied

  // Loop all excluded paths and check if host matches
  return noProxy.split(/[,\s]+/).every(function(path) {
    if (!path) return true;

    // Parse path to separate host and port
    const [, proxyHost, proxyPort] = path.match(/^([^\:]+)?(?::(\d+))?$/);
    if (proxyPort && parseInt(proxyPort) !== port) return true;

    // If no wildcards or beginning with dot, return if exact match
    if (!/^[.*]/.test(proxyHost)) {
        if (hostname === proxyHost) return false;
    }

    // Escape any special characters in the hostname
    const escapedProxyHost = proxyHost.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

    // Replace wildcard characters in the hostname with regular expression wildcards
    const regexProxyHost = escapedProxyHost
        .replace(/^\\\./, "\\*.") // Leading dot = wildcard
        .replace(/\\\.$/, "\\*.") // Trailing dot = wildcard
        .replace(/\\\*/g, ".*");

    // Test the hostname against the regular expression
    return !(new RegExp(`^${regexProxyHost}$`).test(hostname));
  });
};

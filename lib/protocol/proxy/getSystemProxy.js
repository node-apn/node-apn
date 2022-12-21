"use strict";

const getEnv = require("../../util/getEnv");

/**
 * Get proxy connection info from the system environment variables
 * Gathers connection info from environment variables in the following order:
 *   1. apn_proxy
 *   2. npm_config_http/https_proxy (https if targetPort: 443)
 *   3. http/https_proxy (https if targetPort: 443)
 *   4. all_proxy
 *   5. npm_config_proxy
 *   6. proxy
 * 
 * @param {number} targetPort - Port number for the target host/webpage.
 * @returns {Object} proxy - Object containing proxy information from the environment.
 * @returns {string} proxy.host - Proxy hostname
 * @returns {string} proxy.origin - Proxy port number
 * @returns {string} proxy.port - Proxy port number
 * @returns {string} proxy.protocol - Proxy connection protocol
 * @returns {string} proxy.username - Username for connecting to the proxy
 * @returns {string} proxy.password - Password for connecting to the proxy
 */
module.exports = function getSystemProxy(targetPort) {
    const protocol = targetPort === 443 ? "https" : "http";
    let proxy = getEnv('apn_proxy') || getEnv(`npm_config_${protocol}_proxy`) || getEnv(`${protocol}_proxy`) ||
        getEnv('all_proxy') || getEnv('npm_config_proxy') || getEnv('proxy');
    
    // No proxy environment variable set
    if (!proxy) return null;

    // Append protocol scheme if missing from proxy url
    if (proxy.indexOf('://') === -1) {
        proxy = `${protocol}://${proxy}`;
    }

    // Parse proxy as Url to easier extract info
    const parsedProxy = new URL(proxy);
    return {
        host: parsedProxy.hostname || parsedProxy.host,
        origin: parsedProxy.origin,
        port: parsedProxy.port,
        protocol: parsedProxy.protocol,
        username: parsedProxy.username,
        password: parsedProxy.password
    }
};

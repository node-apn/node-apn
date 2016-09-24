"use strict";

module.exports = function(dependencies) {
  const resolve = dependencies.resolve;

  function loadCredentials(credentials) {

    // Prepare PKCS#12 data if available
    var pfx = resolve(credentials.pfx || credentials.pfxData);

    // Prepare Certificate data if available.
    var cert = resolve(credentials.cert || credentials.certData);

    // Prepare Key data if available
    var key = resolve(credentials.key || credentials.keyData);

    return { pfx: pfx, cert: cert, key: key, passphrase: credentials.passphrase };
  }

  return loadCredentials;
};

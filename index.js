const debug = require("debug");

const credentials = require("./lib/credentials")({
  logger: debug("apn:credentials")
});

const config = require("./lib/config")({
  logger: debug("apn:config"),
  prepareCertificate: credentials.certificate,
  prepareToken: credentials.token,
  prepareCA: credentials.ca,
});

const tls = require("tls");

const framer     = require("http2/lib/protocol/framer");
const compressor = require("http2/lib/protocol/compressor");

const protocol = {
  Serializer:   framer.Serializer,
  Deserializer: framer.Deserializer,
  Compressor:   compressor.Compressor,
  Decompressor: compressor.Decompressor,
  Connection:   require("http2/lib/protocol/connection").Connection,
};

const Endpoint = require("./lib/protocol/endpoint")({
  logger: debug("apn:endpoint"),
  tls: tls,
  protocol: protocol,
});

const EndpointManager = require("./lib/protocol/endpointManager")({
  logger: debug("apn:endpointManager"),
  Endpoint: Endpoint
});

const Client = require("./lib/client")({
  logger: debug("apn:client"),
  config: config,
  EndpointManager: EndpointManager,
});

const Provider = require("./lib/provider")({
  logger: debug("apn:provider"),
  Client: Client
});

const Notification = require("./lib/notification")({
  logger: debug("apn:notification")
});

const token = require("./lib/token");

module.exports = {
  Provider,
  Notification,
  token,
};

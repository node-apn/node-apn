const debug = require("debug")("apn");

const parse = require("./lib/credentials/parse")({
	parsePkcs12:  require("./lib/credentials/parsePkcs12"),
	parsePemKey:  require("./lib/credentials/parsePemKey"),
	parsePemCert: require("./lib/credentials/parsePemCertificate"),
});

const prepareCredentials = require("./lib/credentials/prepare")({
	load: require("./lib/credentials/load"),
	parse,
	validate: require("./lib/credentials/validate"),
});

const config = require("./lib/config")({
	debug,
	prepareCredentials,
});

const tls = require("tls");

const framer = require("http2/lib/protocol/framer");
const compressor = require("http2/lib/protocol/compressor");

const protocol = {
	Serializer: framer.Serializer,
	Deserializer: framer.Deserializer,
	Compressor: compressor.Compressor,
	Decompressor: compressor.Decompressor,
	Connection: require("http2/lib/protocol/connection").Connection,
}

const Endpoint = require("./lib/protocol/endpoint")({
	tls,
	protocol,
});

const EndpointManager = require("./lib/protocol/endpointManager")({
	Endpoint,
});

const Connection = require("./lib/connection")({
	config,
	EndpointManager,
});

const Notification = require("./lib/notification");

module.exports = {
	Connection,
	Notification,
};
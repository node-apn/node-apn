"use strict";

const Duplex = require("stream").Duplex;

const noop = () => {};
const noopLogger = {
  fatal: noop,
  error: noop,
  warn : noop,
  info : noop,
  debug: noop,
  trace: noop,

  child: function() { return this; }
};

const CLIENT_PRELUDE = new Buffer('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n');

module.exports = function(dependencies) {
  const tls = dependencies.tls;
  const protocol = dependencies.protocol;

  function Endpoint(options) {
    Duplex.call(this);

    this.options = options;
    options.host = options.host || options.address;
    options.servername = options.address;

    options.ALPNProtocols = ["h2"];

    this._connect();
  }

  Endpoint.prototype = Object.create(Duplex.prototype);

  Endpoint.prototype._connect = function connect() {
    this._socket = tls.connect(this.options);
    this._socket.on("secureConnect", this._connected.bind(this));
    this._socket.on("error", this.emit.bind(this, "error"));
    
    this._connection = new protocol.Connection(noopLogger, 1);
    this._connection.on("error", this.emit.bind(this, "error"));
  }
    
  Endpoint.prototype._connected = function connected() {
    this._socket.pipe(this);
    this.pipe(this._socket);

    this.push(CLIENT_PRELUDE);

    this.emit("connect");
  }

  Endpoint.prototype._read = function _read(size) {
  }

  Endpoint.prototype._write = function _write(chunk, encoding, callback) {
    callback();
  }

  Endpoint.prototype.createStream = function createStream() {
    // return this._h2Endpoint.createStream();
  }

  return Endpoint;
}

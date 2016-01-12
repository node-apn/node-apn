"use strict";

const EventEmitter = require("events");

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

module.exports = function(dependencies) {
  const tls = dependencies.tls;
  const protocol = dependencies.protocol;

  function Endpoint(options) {
    EventEmitter.call(this);

    this.options = options;
    options.host = options.address;
    options.servername = options.address;

    options.ALPNProtocols = ["h2"];

    this._connect();
  }

  Endpoint.prototype = Object.create(EventEmitter.prototype);

  Endpoint.prototype._connect = function connect() {
    this._socket = tls.connect(this.options);
    this._socket.on("secureConnect", this._connected.bind(this));
    this._socket.on("error", this.emit.bind(this, "error"));
    
    this._h2Endpoint = new protocol.Endpoint(noopLogger, 'CLIENT', null);
    this._h2Endpoint.on("error", this.emit.bind(this, "error"));
  }
    
  Endpoint.prototype._connected = function connected() {
    this._socket.pipe(this._h2Endpoint);
    this._h2Endpoint.pipe(this._socket);
  }

  Endpoint.prototype.createStream = function createStream() {
    return this._h2Endpoint.createStream();
  }

  return Endpoint;
}

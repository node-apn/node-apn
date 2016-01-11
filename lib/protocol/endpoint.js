var protocol = require("http2/lib/protocol");
var tls = require("tls");
var EventEmitter = require("events").EventEmitter;

var noop = () => {};
var noopLogger = {
  fatal: noop,
  error: noop,
  warn : noop,
  info : noop,
  debug: noop,
  trace: noop,

  child: function() { return this; }
};

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
  
  this._h2Endpoint = new protocol.Endpoint(noopLogger, 'CLIENT', null);
}
  
Endpoint.prototype._connected = function connected() {
  this._socket.pipe(this._h2Endpoint);
  this._h2Endpoint.pipe(this._socket);
}

Endpoint.prototype.createStream = function createStream() {
  return this._h2Endpoint.createStream();
}

module.exports = Endpoint;

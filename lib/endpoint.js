var protocol = require("http2").protocol;
var tls = require("tls");
var EventEmitter = require("events");
var util = require("util");

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
util.inherits(Endpoint, EventEmitter);

Endpoint.prototype._connect = function connect() {
  this._socket = tls.connect(this.options);
  this._socket.on("secureConnect", () => this._connected() );
}
  
Endpoint.prototype._connected = function connected() {
  this._h2Endpoint = new protocol.Endpoint(noopLogger, 'CLIENT', null);
  this._h2Endpoint.on("error", this.emit.bind(this, "error"));

  this._socket.pipe(this._h2Endpoint);
  this._h2Endpoint.pipe(this._socket); 
}

module.exports = Endpoint;

var h2Endpoint = require("http2").protocol.Endpoint;
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

}
util.inherits(Endpoint, EventEmitter);

Endpoint.prototype.connect = function connect() {
  this._socket = tls.connect(this.options);
  this._socket.on("secureConnect", () => this.connected() );
}
  
Endpoint.prototype.connected = function connected() {
  this._h2Endpoint = new h2Endpoint(noopLogger, 'CLIENT', null);
  this._h2Endpoint.on("error", this.emit.bind(this, "error"));

  this._socket.pipe(this._h2Endpoint);
  this._h2Endpoint.pipe(this._socket); 
}

module.exports = Endpoint;

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

const CLIENT_PRELUDE = new Buffer('PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n');

module.exports = function(dependencies) {
  const tls = dependencies.tls;
  const protocol = dependencies.protocol;

  function Endpoint(options) {
    EventEmitter.call(this);

    this.options = options;
    options.host = options.host || options.address;
    options.servername = options.address;

    this._acquiredStreamSlots = 0;
    this._maximumStreamSlots = 0;

    options.ALPNProtocols = ["h2"];

    this._connect();
    this._setupHTTP2Pipeline();
  }

  Endpoint.prototype = Object.create(EventEmitter.prototype, {
    availableStreamSlots: {
      get: function() {
        return this._maximumStreamSlots - this._acquiredStreamSlots;
      }
    }
  });

  Endpoint.prototype._setupHTTP2Pipeline = function _setupHTTP2Pipeline() {
    const serializer = new protocol.Serializer(noopLogger);
    const compressor = new protocol.Compressor(noopLogger, 'REQUEST');
    const deserializer = new protocol.Deserializer(noopLogger);
    const decompressor = new protocol.Decompressor(noopLogger, 'RESPONSE');

    this._connection.pipe(compressor);
    compressor.pipe(serializer);
    serializer.pipe(this._socket);

    this._socket.pipe(deserializer);
    deserializer.pipe(decompressor);
    decompressor.pipe(this._connection);

    this._connection.on('RECEIVING_SETTINGS_HEADER_TABLE_SIZE', compressor.setTableSizeLimit.bind(compressor));
    this._connection.on('ACKNOWLEDGED_SETTINGS_HEADER_TABLE_SIZE', decompressor.setTableSizeLimit.bind(decompressor));

    this._connection.on('RECEIVING_SETTINGS_MAX_CONCURRENT_STREAMS', maxStreams => {
      this._maximumStreamSlots = maxStreams;
      this.emit("wakeup");
    });

    serializer.on("error", this.emit.bind(this, "error"));
    compressor.on("error", this.emit.bind(this, "error"));
    deserializer.on("error", this.emit.bind(this, "error"));
    decompressor.on("error", this.emit.bind(this, "error"));
  }

  Endpoint.prototype._connect = function connect() {
    this._socket = tls.connect(this.options);
    this._socket.on("secureConnect", this._connected.bind(this));
    this._socket.on("error", this.emit.bind(this, "error"));
    this._socket.write(CLIENT_PRELUDE);
    
    this._connection = new protocol.Connection(noopLogger, 1);
    this._connection.on("error", this.emit.bind(this, "error"));
  }
    
  Endpoint.prototype._connected = function connected() {
    this.emit("connect"); 
  }

  Endpoint.prototype.createStream = function createStream() {
    const stream = this._connection.createStream();

    this._acquiredStreamSlots += 1;
    stream.on("end", () => {
      this._acquiredStreamSlots -= 1;
      this.emit("wakeup");
    });

    return stream;
  }

  return Endpoint;
}

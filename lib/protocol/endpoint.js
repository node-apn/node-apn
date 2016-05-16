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

const CLIENT_PRELUDE = new Buffer("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");

module.exports = function(dependencies) {
  const tls = dependencies.tls;
  const protocol = dependencies.protocol;

  function Endpoint(options) {
    EventEmitter.call(this);

    this.options = options;
    options.host = options.host || options.address;
    options.servername = options.address;

    this._backoff = 5 * 1000;
    this._maxBackoff = 60 * 10 * 1000;

    this._acquiredStreamSlots = 0;
    this._maximumStreamSlots = 0;

    options.ALPNProtocols = ["h2"];

    this._connect();
  }

  Endpoint.prototype = Object.create(EventEmitter.prototype, {
    availableStreamSlots: {
      get: function() {
        return this._maximumStreamSlots - this._acquiredStreamSlots;
      }
    }
  });

  Endpoint.prototype._setupHTTP2Pipeline = function _setupHTTP2Pipeline() {
    this._connection = new protocol.Connection(noopLogger, 1);
    this._connection.on("error", this.emit.bind(this, "error"));

    const serializer = new protocol.Serializer(noopLogger.child("serializer"));
    const compressor = new protocol.Compressor(noopLogger.child("compressor"), "REQUEST");
    const deserializer = new protocol.Deserializer(noopLogger.child("deserializer"));
    const decompressor = new protocol.Decompressor(noopLogger.child("decompressor"), "RESPONSE");

    this._connection.pipe(compressor);
    compressor.pipe(serializer);
    serializer.pipe(this._socket);

    this._socket.pipe(deserializer);
    deserializer.pipe(decompressor);
    decompressor.pipe(this._connection);

    this._connection.on("RECEIVING_SETTINGS_HEADER_TABLE_SIZE", compressor.setTableSizeLimit.bind(compressor));
    this._connection.on("ACKNOWLEDGED_SETTINGS_HEADER_TABLE_SIZE", decompressor.setTableSizeLimit.bind(decompressor));

    this._connection.on("RECEIVING_SETTINGS_MAX_CONCURRENT_STREAMS", maxStreams => {
      this._maximumStreamSlots = maxStreams;
      this.emit("wakeup");
    });

    serializer.on("error", this.emit.bind(this, "error"));
    compressor.on("error", this.emit.bind(this, "error"));
    deserializer.on("error", this.emit.bind(this, "error"));
    decompressor.on("error", this.emit.bind(this, "error"));
  };

  Endpoint.prototype._connect = function connect() {
    this._socket = tls.connect(this.options);
    this._socket.on("secureConnect", this._connected.bind(this));
    this._socket.on("error", this.emit.bind(this, "error"));
    // debug
    this._socket.on("lookup", (err, address) => console.error(
      new Date(),
      this._backoff / 1000 + 's',
      address
    ));
    /**
     * Currently some push api IP's are hanging on TLS handshaking
     * https://forums.developer.apple.com/thread/44866
     * to combat this we "reset" the socket after a timeout,
     * should it not connect during this period.
     */
    if(this._backoff < this._maxBackoff) {
      var handshakeTimeout = setTimeout(() => {
        this._socket.destroy();
        this._backoff *= 2;
        this._connect();
      }, this._backoff);

      this._socket.once("secureConnect", () => {
        clearTimeout(handshakeTimeout)
      });
    }
  };

  Endpoint.prototype._connected = function connected() {
    this._socket.write(CLIENT_PRELUDE);
    this._setupHTTP2Pipeline();
    this.emit("connect");
  };

  Endpoint.prototype.createStream = function createStream() {
    let stream = this._connection.createStream();

    this._acquiredStreamSlots += 1;
    stream.on("end", () => {
      stream = null;
      this._acquiredStreamSlots -= 1;
      this.emit("wakeup");
    });

    return stream;
  };

  return Endpoint;
};

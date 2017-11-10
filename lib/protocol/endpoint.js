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

const CLIENT_PRELUDE = Buffer.from("PRI * HTTP/2.0\r\n\r\nSM\r\n\r\n");

module.exports = function(dependencies) {
  const tls = dependencies.tls;
  const http = dependencies.http;
  const protocol = dependencies.protocol;

  function Endpoint(options) {
    EventEmitter.call(this);

    this.options = Object.assign({}, options);
    this.options.ALPNProtocols = ["h2"];
    this.options.host = options.host || options.address;
    this.options.servername = options.address;
    if (options.proxy){
      this.options.targetHost = this.options.host;
      this.options.targetPort = this.options.port;
      this.options.host = this.options.proxy.host;
      this.options.port = this.options.proxy.port || this.options.port;
    }

    this._acquiredStreamSlots = 0;
    this._maximumStreamSlots = 0;
    this._lastSuccessPingedTime = null;
    this._pingedThreshold = (this.options.heartBeat || 60000) * 2.5;
    this._heartBeatInterval = (this.options.heartBeat || 60000);

    this._connect();
    this._heartBeatIntervalCheck = this._setupHTTP2HealthCheck();
  }

  Endpoint.prototype = Object.create(EventEmitter.prototype, {
    availableStreamSlots: {
      get: function() {
        return this._maximumStreamSlots - this._acquiredStreamSlots;
      }
    }
  });

  Endpoint.prototype._setupHTTP2Pipeline = function _setupHTTP2Pipeline() {
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

    serializer.on("error", this._protocolError.bind(this, "serializer"));
    compressor.on("error", this._protocolError.bind(this, "compressor"));
    deserializer.on("error", this._protocolError.bind(this, "deserializer"));
    decompressor.on("error", this._protocolError.bind(this, "decompressor"));
  };

  Endpoint.prototype._connect = function connect() {
    // Connecting directly to the remote host
    if (!this.options.proxy) {
      return this._socketOpened(tls.connect(this.options));
    }

    // Connecting through an HTTP proxy
    const req = http.request({
      host: this.options.host,
      port: this.options.port,
      method: "CONNECT",
      headers: { Connection: "Keep-Alive" },
      path: `${this.options.targetHost}:${this.options.targetPort}`,
    });
    req.end();

    req.on("error", this._error.bind(this));
    req.on("connect", (res, socket) => {
      const optionsWithProxy = Object.assign({}, this.options, {
        socket,
        host: this.options.targetHost,
        port: this.options.targetPort
      });
      this._socketOpened(tls.connect(optionsWithProxy));
    });
  };

  Endpoint.prototype._socketOpened = function _socketOpened(socket) {
    this._socket = socket;
    this._socket.on("secureConnect", this._connected.bind(this));
    this._socket.on("error", this._error.bind(this));
    this._socket.on("close", this._close.bind(this));
    this._socket.on("end", this.emit.bind(this, "end"));
    this._socket.write(CLIENT_PRELUDE);

    this._connection = new protocol.Connection(noopLogger, 1);
    this._connection.on("error", this._protocolError.bind(this, "connection"));
    this._connection.on("GOAWAY", this._goaway.bind(this));

    this._setupHTTP2Pipeline();
  };

  Endpoint.prototype._connected = function connected() {
    this.emit("connect");
  };

  Endpoint.prototype._setupHTTP2HealthCheck = function healthcheck() {
    return setInterval(() => {
      if (this._lastSuccessPingedTime != null && (Date.now() - this._lastSuccessPingedTime) > this._pingedThreshold) {
        this._error("Not receiving Ping response after " + this._pingedThreshold + " ms");
      } else {
        this._connection.ping(() => { 
          this._lastSuccessPingedTime = Date.now(); 
        });
      }
    }, this._heartBeatInterval);
  };

  Endpoint.prototype._protocolError = function protocolError(component, errCode) {
    this._error(component + " error: " + errCode);
  };

  Endpoint.prototype._error = function error(err) {
    this.lastError = err;

    this.emit("error", err);
  };

  Endpoint.prototype._goaway = function goaway(frame) {
    // When we receive a goaway we must be prepared to
    // signal streams which have not been processed by the
    // server enabling them to be re-enqueued. We hold
    // onto the last stream ID to process it in `close`
    this.lastStream = frame.last_stream;

    if (frame.error === "NO_ERROR") {
      return;
    }

    let message = "GOAWAY: " + frame.error;
    if(frame.debug_data) {
      message += " " + frame.debug_data.toString();
    }
    this._error(message);
  }

  Endpoint.prototype._close = function close() {
    // After the endpoint closes we loop through all
    // dangling streams to handle their state.
    this._connection._streamIds.forEach( (stream, id) => {

      // Ignore stream 0 (connection stream)
      if (id === 0) {
        return;
      }

      // let stream = this._connection._streamIds[id];

      // Is stream unprocessed? (last_stream < id)
      if (this.lastStream < id) {
        stream.emit("unprocessed");

      } else if (this.lastError) {
        // If it *has* been at least partially processed
        // and an error has occurred
        stream.emit("error", this.lastError);
      }
    });
  }

  Endpoint.prototype.createStream = function createStream() {
    let stream = this._connection.createStream();
    this._connection._allocateId(stream);

    this._acquiredStreamSlots += 1;
    stream.on("end", () => {
      stream = null;
      this._acquiredStreamSlots -= 1;
      this.emit("wakeup");

      if (this._closePending) {
        this.close();
      }
    });

    return stream;
  };

  Endpoint.prototype.close = function close() {
    if (this._acquiredStreamSlots === 0) {
      this._connection.close();
    }
    this._closePending = true;
  };

  Endpoint.prototype.destroy = function destroy() {
    clearInterval(this._heartBeatIntervalCheck);
    if(this._socket) this._socket.destroy();
  };

  return Endpoint;
};

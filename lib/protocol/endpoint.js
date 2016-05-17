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

	class Endpoint extends EventEmitter {

		constructor (options) {
			super();

			this.options = options;
			options.host = options.host || options.address;
			options.servername = options.address;

			this._retries = 0;

			this._acquiredStreamSlots = 0;
			this._maximumStreamSlots = 0;

			options.ALPNProtocols = ["h2"];

			this._connect();
		};

		get availableStreamSlots () {
			return this._maximumStreamSlots - this._acquiredStreamSlots;
		};

		_setupHTTP2Pipeline () {
			const serializer = new protocol.Serializer(noopLogger.child("serializer"));
			const compressor = new protocol.Compressor(noopLogger.child("compressor"), "REQUEST");
			const deserializer = new protocol.Deserializer(noopLogger.child("deserializer"));
			const decompressor = new protocol.Decompressor(noopLogger.child("decompressor"), "RESPONSE");

			this._connection = new protocol.Connection(noopLogger, 1);
			this._connection.on("error", this.emit.bind(this, "error"));
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

		_connect() {
			this._socket = tls.connect(this.options);
			this._socket.on("secureConnect", this._connected.bind(this));
			// debug
			this._socket.on("lookup", (err, address) => console.error(this._retries, address));
			/**
			 * Currently some push api IP's are hanging on TLS handshaking
			 * https://forums.developer.apple.com/thread/44866
			 * to combat this we "reset" the socket after a timeout,
			 * should it not connect during this period.
			 */
			this._socket.on("error", (err) => {
				const reconnectErrors = ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED"];

				if (reconnectErrors.indexOf(err.errno) !== -1) {
					if (this._retries < this.options.connectionRetryLimit) {
						this._socket.destroy();
						this._retries++;
						this._connect();
						return;
					}
				}

				this.emit("error", err);
			});

			this._socket.write(CLIENT_PRELUDE);
			this._setupHTTP2Pipeline();
		};

		_connected () {
			this._retries = 0;
			this.emit("connect");
		};

		createStream () {
			let stream = this._connection.createStream();

			this._acquiredStreamSlots += 1;
			stream.on("end", () => {
				stream = null;
				this._acquiredStreamSlots -= 1;
				this.emit("wakeup");
			});

			return stream;
		};
	}

	return Endpoint;
};

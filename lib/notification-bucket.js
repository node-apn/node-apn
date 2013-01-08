var util = require('./util');

var debug = function() {};
if(process.env.DEBUG) {
	try {
		debug = require('debug')('apn');
	}
	catch (e) {
		console.log("Notice: 'debug' module is not available. This should be installed with `npm install debug` to enable debug messages", e);
		debug = function() {};
	}
}

/**
 * Create a notification bucket, a container of multiple notification data.
 * @constructor
 * @config {Boolean} [enhanced=true] Whether to use the enhanced notification format (recommended)
 * @config {Number} [maxLength=8192] Length of the container buffer.
 */
function NotificationBucket(options) {
	this.options = {
		enhanced: true,
		maxLength: 8192
	};
	util.extend(this.options, options);

	this.notificationCount = 0;
	this.buffer = new Buffer(this.options.maxLength);
	this.position = 0;
	this.setupSentinelNotification();

	if (this.options.enhanced) {
		this.purgeNotificationUntil = this.purgeNotificationFromEnhanceFormattedBufferUntil;
	} else {
		this.purgeNotificationUntil = this.clear;
	}
};

/**
 * @private
 */
NotificationBucket.prototype.setupSentinelNotification = function () {
	if (this.options.enhanced) {
		this.sentinelNotification = new Buffer(13);
		this.sentinelNotification.fill(0);
		this.sentinelNotification[0] = 1;
	} else {
		this.sentinelNotificationLength = new Buffer(5);
		this.sentinelNotification.fill(0);
	}
};

/**
 * Get the buffer itself.
 */
NotificationBucket.prototype.getBuffer = function () {
	return this.buffer;
};

/**
 * Get available length, free space of the buffer in bytes.
 */
NotificationBucket.prototype.availableLength = function () {
	return this.options.maxLength - this.position;
};

/**
 * Calculate the length of a notification in bytes.
 * @param {Object} compiledNotification  A compiled notification.
 * @param {Buffer} deviceToken A device token.
 */
NotificationBucket.prototype.calculateNotificationLength = function (compiledNotification, deviceToken) {
	if (this.options.enhanced) {
		return 11 + deviceToken.length + 2 + compiledNotification.payload.length;
	} else {
		return 3 + deviceToken.length + 2 + compiledNotification.payload.length;
	}
};

/**
 * Append a notification to the end of the buffer.
 * @param {Object} compiledNotification  A notification compiledNotification in binary format.
 * @param {Buffer} deviceToken A device token.
 * @param {Number} id  APN identifier.
 */
NotificationBucket.prototype.appendToBuffer = function (compiledNotification, deviceToken, id) {
	var requriedLength = this.calculateNotificationLength(compiledNotification, deviceToken);
	if (this.availableLength() < requriedLength) {
		// client should check this buffer's availability before call this.
		debug('notification buffer is full: %d < %d', this.availableLength(), requriedLength);
		throw new Error('notification buffer is full');
	}

	var position = this.position;
	var buffer = this.buffer;
	if (this.options.enhanced) {
		// Command
		buffer[position] = 1;
		position++;

		// Identifier
		buffer.writeUInt32BE(id, position);
		position += 4;

		// Expiry
		buffer.writeUInt32BE(compiledNotification.expiry, position);
		position += 4;
	} else {
		//Command
		buffer[position] = 0;
		position++;
	}
	// Token Length
	buffer.writeUInt16BE(deviceToken.length, position);
	position += 2;
	// Device Token
	position += deviceToken.copy(buffer, position, 0);
	// Payload Length
	buffer.writeUInt16BE(compiledNotification.payload.length, position);
	position += 2;
	//Payload
	position += compiledNotification.payload.copy(buffer, position, 0);

	this.position = position;
	this.notificationCount++;
};

/**
 * Get the length of a sentinel notification in bytes.
 */
NotificationBucket.prototype.sentinelNotificationLength = function () {
	return this.sentinelNotification.length;
};

/**
 * Append a sentinel notification to the end of buffer.
 * @param {Number} id  APN identifier.
 */
NotificationBucket.prototype.appendSentinelNotification = function (id) {
	if (this.availableLength() < this.sentinelNotification.length) {
		// client should check this buffer's availability before call this.
		debug('length %d < %d', this.availableLength(), this.sentinelNotification.length);
		throw new Error('notification buffer is full');
	}

	if (this.options.enhanced) {
		// populate Identifier
		this.sentinelNotification.writeUInt32BE(id, 1);
	}
	this.sentinelNotification.copy(this.buffer, this.position, 0);
	this.position += this.sentinelNotification.length;
};

/**
 * Clear the buffer.
 */
NotificationBucket.prototype.clear = function () {
	debug('clear notification buffer');
	this.position = 0;
	this.notificationCount = 0;
};

/**
 * @private
 */
NotificationBucket.prototype.traverseEnhancedFormatBuffer = function (callback) {
	var run = 0;
	var end = this.position;
	var buffer = this.buffer;
	while (run < end) {
		var begin = run;
		var sentId = buffer.readUInt32BE(run + 1);
		run += 9;
		var tokenLength = buffer.readUInt16BE(run);
		run += 2 + tokenLength;
		var messageLength = buffer.readUInt16BE(run);
		run += 2 + messageLength;
		if (callback(begin, run, sentId) === false) {
			break;
		}
	}
};

/**
 * This function is dedicated for enhanced formatted buffer. Call NotificationBucket#purgeNotificationUntil instead.
 * @private
 */
NotificationBucket.prototype.purgeNotificationFromEnhanceFormattedBufferUntil = function (id) {
	var nextPosition = null;
	var purgeCount = 0;
	this.traverseEnhancedFormatBuffer(function (head, end, sentId) {
		debug('traverseEnhancedFormatBuffer: %d <=> %d', id, sentId);
		++purgeCount;
		if (sentId === id) {
			nextPosition = end;
			return false;
		}
	});

	if (nextPosition === null) {
		// not found
		debug('notification is not found for id %d; cannot purge buffer', id);
		return false;
	}

	if (this.position <= nextPosition) {
		// found at the last entry; we can simply purge the entire buffer
		debug('purged entire buffer');
		this.clear();
		return purgeCount;
	}

	// move rest of notifications to the head of the buffer
	debug('purged some notifications');
	this.buffer.copy(this.buffer, 0, nextPosition);
	this.position -= nextPosition;
	this.notificationCount -= purgeCount;

	// remove sentinel notification from the buffer, which should be located at the tail
	if (this.sentinelNotification.length <= this.position) {
		var position = this.position - this.sentinelNotification.length;
		var tokenLength = this.buffer.readUInt16BE(position + 9);
		if (tokenLength === 0) {
			this.position = position;
			debug('removed sentinel notification from the buffer');
		} else {
			debug('**no sentinel notification in the buffer**');
		}
	}

	return purgeCount;
};

module.exports = NotificationBucket;


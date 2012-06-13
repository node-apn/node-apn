var extend = function(target) {
	Array.prototype.slice.call(arguments, 1).forEach(function(source) {
		for (key in source) {
			if (source[key] !== undefined) {
				target[key] = source[key];
			}
		}
	});
}

var int2bytes = function (number, buffer, start, length) {
	for (var i = (start + length - 1); i >= start; --i) {
		buffer[i] = number & 0xff;
		number = number >> 8;
	}
	return length;
}

var bytes2int = function (bytes, length, start) {
	if (start === undefined) start = 0;
	var result = 0;
	length -= 1;
	for (var i = 0; i <= length; i++) {
		result += (bytes[start + i] << ((length - i) * 8));
	}
	return result;
}

exports.extend = extend;
exports.int2bytes = int2bytes;
exports.bytes2int = bytes2int;
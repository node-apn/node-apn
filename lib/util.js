var extend = function(target) {
	Array.prototype.slice.call(arguments, 1).forEach(function(source) {
		for (var key in source) {
			if (source[key] !== undefined) {
				target[key] = source[key];
			}
		}
	});
};

var apnSetImmediate = function (method) {
	if('function' === typeof setImmediate) {
		setImmediate(method);
	}
	else {
		process.nextTick(method);
	}
};

module.exports.extend = extend;
module.exports.setImmediate = apnSetImmediate;

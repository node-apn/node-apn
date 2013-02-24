var extend = function(target) {
	Array.prototype.slice.call(arguments, 1).forEach(function(source) {
		for (var key in source) {
			if (source[key] !== undefined) {
				target[key] = source[key];
			}
		}
	});
};

module.exports.extend = extend;
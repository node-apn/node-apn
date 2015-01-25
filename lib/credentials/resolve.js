var fs = require("fs");
var q = require("q");

var resolveCredential = function(value) {
	if (!value) return value;
	if(/-----BEGIN ([A-Z\s*]+)-----/.test(value)) {
		return value;
	}
	else if(Buffer.isBuffer(value)) {
		return value;
	}
	else {
		return q.nfbind(fs.readFile)(value);
	}
}

module.exports = resolveCredential;
"use strict";

var fs = require("fs");
var Promise = require("bluebird");

function resolveCredential(value) {
	if (!value) {
		return value;
	}
	if(/-----BEGIN ([A-Z\s*]+)-----/.test(value)) {
		return value;
	}
	else if(Buffer.isBuffer(value)) {
		return value;
	}
	else {
		return Promise.promisify(fs.readFile)(value);
	}
}

module.exports = resolveCredential;

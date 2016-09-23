"use strict";

module.exports = function extend(target) {
	for (let i=1; i<arguments.length; i++) {
		let source = arguments[i];
	  for (var key in source) {
	    if (source[key] !== undefined) {
	      target[key] = source[key];
	    }
	  }
	}
  return target;
};

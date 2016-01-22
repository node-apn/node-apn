"use strict";

module.exports = function(dependencies) {

	const Endpoint = dependencies.Endpoint;

	function EndpointManager() {
		this._endpoints = [];
	}

	EndpointManager.prototype.getStream = function getStream() {
		var endpoint = new Endpoint();
	}

	return EndpointManager;
}
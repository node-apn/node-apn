"use strict";

module.exports = {
	set alert(value) {
		this.aps.alert = value;
	},

	get body() {
		if (this.aps.alert) {
			return this.aps.alert.body || this.aps.alert;
		}
		return this.aps.alert;
	},

	set body(value) {
		if(typeof this.aps.alert !== "object") {
			this.aps.alert = value;
		}
		else {
			this.prepareAlert();
			this.aps.alert.body = value;
		}
	},

	set locKey(value) {
		this.prepareAlert();
		this.aps.alert["loc-key"] = value;
	},

	set locArgs(value) {
		this.prepareAlert();
		this.aps.alert["loc-args"] = value;
	},

	set title(value) {
		this.prepareAlert();
		this.aps.alert.title = value;
	},

	set subtitle(value) {
		this.prepareAlert();
		this.aps.alert.subtitle = value;
	},

	set titleLocKey(value) {
		this.prepareAlert();
		this.aps.alert["title-loc-key"] = value;
	},

	set titleLocArgs(value) {
		this.prepareAlert();
		this.aps.alert["title-loc-args"] = value;
	},

	set action(value) {
		this.prepareAlert();
		this.aps.alert.action = value;
	},

	set actionLocKey(value) {
		this.prepareAlert();
		this.aps.alert["action-loc-key"] = value;
	},

	set launchImage(value) {
		this.prepareAlert();
		this.aps.alert["launch-image"] = value;
	},

	set badge(value) {
		if (typeof value === "number" || value === undefined) {
			this.aps.badge = value;
		}
	},

	set sound(value) {
		if (typeof value === "string" || value === undefined) {
			this.aps.sound = value;
		}
	},

	set contentAvailable(value) {
		if (value === true || value === 1) {
			this.aps["content-available"] = 1;
		} else {
			this.aps["content-available"] = undefined;
		}
	},

	set mutableContent(value) {
		if (value === true || value === 1) {
			this.aps["mutable-content"] = 1;
		} else {
			this.aps["mutable-content"] = undefined;
		}
	},

	set mdm(value) {
		this._mdm = value;
	},

	set urlArgs(value) {
		if(Array.isArray(value) || value === undefined) {
			this.aps["url-args"] = value;
		}
	},

	set category(value) {
		if(typeof value === "string" || value === undefined) {
			this.aps.category = value;
		}
	},

	prepareAlert: function () {
		if(typeof this.aps.alert !== "object") {
			this.aps.alert = {"body": this.aps.alert};
		}
	}
};

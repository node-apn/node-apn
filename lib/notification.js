var Notification = function () {
	this.payload = {};
	this.expiry = 0;
	this.identifier = 0;
	this.device;

	this.alert = undefined;
	this.badge = undefined;
	this.sound = undefined;
};

Notification.prototype.toJSON = function () {
	if (this.payload === undefined) {
		this.payload = {};
	}
	if (this.payload.aps === undefined) {
		this.payload.aps = {};
	}
	if (typeof this.badge == 'number') {
		this.payload.aps.badge = this.badge;
	}
	if (typeof this.sound == 'string') {
		this.payload.aps.sound = this.sound;
	}
	if (typeof this.alert == 'string' || typeof this.alert == 'object') {
		this.payload.aps.alert = this.alert;
	}
	return this.payload;
};

module.exports = Notification;
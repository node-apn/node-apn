// Require apn
var apns = require('apn');

// This function should be called every time a notification is not properly sent to APNS.
var callbackFunction = function(err, notification){
    	console.log("Fail callback Called : " + err);
    	console.log("notification: " + notification);
};

var deviceToken = "INSERT YOUR TOKEN HERE";

// APNS Connection Options.
var options = {
    cert: null, 	              /* Certificate file path */
    certData: null,                   /* String or Buffer containing certificate data, if supplied uses this instead of cert file path */
    key:  null,		              /* Key file path */
    keyData: null,                    /* String or Buffer containing key data, as certData */
    passphrase: null,                 /* A passphrase for the Key file */
    ca: null,                         /* String or Buffer of CA data to use for the TLS connection */
    pfx: null,                        /* File path for private key, certificate and CA certs in PFX or PKCS12 format. If supplied will be used instead of 						 certificate and key above */
    pfxData: null,                    /* PFX or PKCS12 format data containing the private key, certificate and CA certs. If supplied will be used instead 						 of loading from disk. */
    gateway: 'gateway.sandbox.push.apple.com',
    port: 2195,                       /* gateway port */
    rejectUnauthorized: true,         /* Value of rejectUnauthorized property to be passed through to tls.connect() */
    enhanced: true,                   /* enable enhanced format */
    cacheLength: 100,                 /* Number of notifications to cache for error purposes */
    autoAdjustCache: true,            /* Whether the cache should grow in response to messages being lost after errors. */
    connectionTimeout: 60000,         /* The duration the socket should stay alive with no activity in milliseconds. 0 = Disabled. */
    errorCallback: callbackFunction   /* Callback when error occurs function(err,notification) */
};

// Creating the connection and the device to send notifications.
var apnsConnection = new apns.Connection(options);
var myDevice = new apns.Device(deviceToken);

//////////////////////////////////////////////////////////////////////////////////////
// This method runs every 2 seconds, and tries to send a notification to the device.//
//////////////////////////////////////////////////////////////////////////////////////

var periodicTask = function () {

	var note = new apns.Notification();

	note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
	note.badge = 3;
	note.sound = "ping.aiff";
	note.alert = "You have a new message";
	note.payload = {'messageFrom': 'Caroline'};
	note.device = myDevice;
	apnsConnection.sendNotification(note);

	console.log("Sent notification...");
	setTimeout(periodicTask, 2 * 1000);
}

// Start running periodically the task.
periodicTask();


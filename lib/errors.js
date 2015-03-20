"use strict";
/**
 * Error codes used by Apple
 * @see <a href="https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CommunicatingWIthAPS/CommunicatingWIthAPS.html#//apple_ref/doc/uid/TP40008194-CH101-SW4">The Binary Interface and Notification Formats</a>
 */

var Errors = {
	"noErrorsEncountered": 0,
	"processingError": 1,
	"missingDeviceToken": 2,
	"missingTopic": 3,
	"missingPayload": 4,
	"invalidTokenSize": 5,
	"invalidTopicSize": 6,
	"invalidPayloadSize": 7,
	"invalidToken": 8,
	"apnsShutdown": 10,
	"none": 255,
	"retryLimitExceeded": 512,
	"moduleInitialisationFailed": 513,
	"connectionRetryLimitExceeded": 514, // When a connection is unable to be established. Usually because of a network / SSL error this will be emitted
	"connectionTerminated": 515
};

module.exports = Errors;
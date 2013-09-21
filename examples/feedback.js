var apn = require ('../index.js');

// Setup a connection to the feedback service using a custom interval (10 seconds)
var feedback = new apn.feedback({ address:'feedback.sandbox.push.apple.com', interval: 10 });

feedback.on('feedback', handleFeedback);
feedback.on('feedbackError', console.error);

function handleFeedback(feedbackData) {
	var time, device;
	for(var i in feedbackData) {
		time = feedbackData[i].time;
		device = feedbackData[i].device;

		console.log("Device: " + device.toString('hex') + " has been unreachable, since: " + time);
	}
}

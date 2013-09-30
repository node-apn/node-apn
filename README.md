#node-apn

A Node.js module for interfacing with the Apple Push Notification service.

## Features

- Fast
- Maintains a connection to the server to maximise notification batching and throughput.
- Enhanced binary interface support, with error handling
- Automatically sends unsent notifications if an error occurs
- Feedback service support
- Complies with all best practises laid out by Apple

## Installation

Via [npm][]:

	$ npm install apn
	
As a submodule of your project (you will also need to install [q][q])

	$ git submodule add http://github.com/argon/node-apn.git apn
	$ git submodule update --init

## Quick Start

This is intended as a brief introduction, please refer to the documentation in `doc/` for more details.

### Load in the module

	var apn = require('apn');

### Connecting
Create a new connection to the APN gateway server using a dictionary of options. If you name your certificate and key files appropriately (`cert.pem` and `key.pem`) then the defaults should be suitable to get you up and running, the only thing you'll need to change is the `gateway` if you're in the sandbox environment.

```javascript
	var options = { "gateway": "gateway.sandbox.push.apple.com" };

	var apnConnection = new apn.Connection(options);
```

Help with preparing the key and certificate files for connection can be found in the [wiki][certificateWiki]

### Sending a notification
To send a notification first create a `Device` object. Pass it the device token as either a hexadecimal string, or alternatively as a `Buffer` object containing the token in binary form.

	var myDevice = new apn.Device(token);

Next, create a notification object, set the relevant parameters (See the [payload documentation][pl] for more details.) and use the `pushNotification` method on the connection to send it.

	var note = new apn.Notification();
	
	note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
	note.badge = 3;
	note.sound = "ping.aiff";
	note.alert = "\uD83D\uDCE7 \u2709 You have a new message";
	note.payload = {'messageFrom': 'Caroline'};
	
	apnConnection.pushNotification(note, myDevice);

The above options will compile the following dictionary to send to the device:

	{"messageFrom":"Caroline","aps":{"badge":3,"sound":"ping.aiff","alert":"\uD83D\uDCE7 \u2709 You have a new message"}}

### Setting up the feedback service

Apple recommends checking the feedback service periodically for a list of devices for which there were failed delivery attempts.

Using the `Feedback` object it is possible to periodically query the server for the list. Many of the options are similar to that of `Connection`.

Attach a listener to the `feedback` event to receive the output as two arguments, the `time` returned by the server (epoch time) and a `Buffer` object containing the device token - this event will be emitted for each device separately. Alternatively you can enable the `batchFeedback` option and the `feedback` event will provide an array of objects containing `time` and `device` properties.

	var options = {
		"batchFeedback": true,
		"interval": 300
	};

	var feedback = new apn.Feedback(options);
	feedback.on("feedback", function(devices) {
		devices.forEach(function(item) {
			// Do something with item.device and item.time;
		});
	});

By specifying a time interval (in seconds) `Feedback` will periodically query the service without further intervention.

More information about the feedback service can be found in the [feedback service documentation][fs].

## Debugging

If you experience difficulties sending notifications or using the feedback service you can enable debug messages within the library by running your application with `DEBUG=apn` or `DEBUG=apnfb` set as an environment variable.

You will need the `debug` module which can be installed with `npm install debug`.

You are encouraged to read the extremely informative [Troubleshooting Push Notifications][tn2265] Tech Note in the first instance, in case your query is answered there.

## Support

If you have any questions or difficulties working with the module, the [node-apn Google group][googlegroup] should be your first port of call. 

Please include as much detail as possible - especially debug logs, if the problem is reproducible sample code is also extremely helpful. GitHub Issues should only be created for verified problems and enhancements, this will allow them to be tracked more easily.

## Resources

* [Local and Push Notification Programming Guide: Apple Push Notification Service][pl]
* [Apple Technical Note: Troubleshooting Push Notifications][tn2265]
* [List of Projects, Applications and Companies Using Node-apn][pacapn]

## Credits

Written and maintained by [Andrew Naylor][andrewnaylor].

Thanks to: [Ian Babrou][bobrik], [dgthistle][dgthistle], [Keith Larsen][keithnlarsen], [Mike P][mypark], [Greg Bergé][neoziro], [Asad ur Rehman][AsadR], [Nebojsa Sabovic][nsabovic], [Alberto Gimeno][gimenete], [Randall Tombaugh][rwtombaugh], [Michael Stewart][thegreatmichael], [Olivier Louvignes][mgcrea], [porsager][porsager], [Craig Hockenberry][chockenberry]

## License

Released under the MIT License

Copyright (c) 2013 Andrew Naylor

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[certificateWiki]:https://github.com/argon/node-apn/wiki/Preparing-Certificates "Preparing Certificates"
[errors]:https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/CommunicatingWIthAPS.html#//apple_ref/doc/uid/TP40008194-CH101-SW4 "The Binary Interface and Notification Formats"
[pl]: https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW1 "Local and Push Notification Programming Guide: Apple Push Notification Service"
[fs]: https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/CommunicatingWIthAPS.html#//apple_ref/doc/uid/TP40008194-CH101-SW3 "The Feedback Service"
[tn2265]: http://developer.apple.com/library/ios/#technotes/tn2265/_index.html "Troubleshooting Push Notifications"
[googlegroup]:https://groups.google.com/group/node-apn "node-apn Google Group"
[pacapn]:https://github.com/argon/node-apn/wiki/Projects,-Applications,-and-Companies-Using-Node-apn "List of Projects, Applications and Companies Using Node-apn"
[andrewnaylor]: http://andrewnaylor.co.uk
[bnoordhuis]: http://bnoordhuis.nl
[npm]: https://npmjs.org
[bobrik]: http://bobrik.name
[dgthistle]: https://github.com/dgthistle
[keithnlarsen]: https://github.com/keithnlarsen
[mypark]: https://github.com/mypark
[neoziro]: https://github.com/neoziro
[AsadR]: https://github.com/AsadR
[nsabovic]: https://github.com/nsabovic
[gimenete]: https://github.com/gimenete
[rwtombaugh]: https://github.com/rwtombaugh
[thegreatmichael]: https://github.com/thegreatmichael
[mgcrea]: https://github.com/mgcrea
[porsager]: https://github.com/porsager
[q]: https://github.com/kriskowal/q
[chockenberry]: https://github.com/chockenberry


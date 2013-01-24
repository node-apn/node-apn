#node-apn

A Node.js module for interfacing with the Apple Push Notification service.

## Features

- Maintains a connection to the server to maximise notification batching
- Enhanced binary interface support with error handling
- Automatically sends unsent notifications if an error occurs
- Feedback service support

## Installation

Via [npm][]:

	$ npm install apn
	
As a submodule of your project (you will also need to install [q][q])

	$ git submodule add http://github.com/argon/node-apn.git apn
	$ git submodule update --init

## Usage
### Load in the module

	var apns = require('apn');

### Exported Objects
- Connection
- Notification
- Device
- Feedback
- Errors

### Connecting
Create a new connection to the gateway server using a dictionary of options. The defaults are listed below:

	var options = {
		cert: 'cert.pem',                 /* Certificate file path */
		certData: null,                   /* String or Buffer containing certificate data, if supplied uses this instead of cert file path */
		key:  'key.pem',                  /* Key file path */
		keyData: null,                    /* String or Buffer containing key data, as certData */
		passphrase: null,                 /* A passphrase for the Key file */
		ca: null,						  /* String or Buffer of CA data to use for the TLS connection */
		pfx: null,						  /* File path for private key, certificate and CA certs in PFX or PKCS12 format. If supplied will be used instead of certificate and key above */
		pfxData: null,					  /* PFX or PKCS12 format data containing the private key, certificate and CA certs. If supplied will be used instead of loading from disk. */
		gateway: 'gateway.push.apple.com',/* gateway address */
		port: 2195,                       /* gateway port */
		rejectUnauthorized: true,		  /* Value of rejectUnauthorized property to be passed through to tls.connect() */
		enhanced: true,                   /* enable enhanced format */
		errorCallback: undefined,         /* Callback when error occurs function(err,notification) */
		cacheLength: 100,                  /* Number of notifications to cache for error purposes */
		autoAdjustCache: true,			  /* Whether the cache should grow in response to messages being lost after errors. */
		connectionTimeout: 0 			  /* The duration the socket should stay alive with no activity in milliseconds. 0 = Disabled. */
	};

	var apnsConnection = new apns.Connection(options);
	
**Important:** In a development environment you must set `gateway` to `gateway.sandbox.push.apple.com`.

### Sending a notification
To send a notification first create a `Device` object. Pass it the device token as either a hexadecimal string, or alternatively as a `Buffer` object containing the token in binary form.

	var myDevice = new apns.Device(token);

Next, create a notification object and set parameters. See the [payload documentation][pl] for more details.

	var note = new apns.Notification();
	
	note.expiry = Math.floor(Date.now() / 1000) + 3600; // Expires 1 hour from now.
	note.badge = 3;
	note.sound = "ping.aiff";
	note.alert = "You have a new message";
	note.payload = {'messageFrom': 'Caroline'};
	note.device = myDevice;
	
	apnsConnection.sendNotification(note);
	
As of version 1.2.0 it is also possible to use a set of methods provided by Notification object (`setAlertText`, `setActionLocKey`, `setLocKey`, `setLocArgs`, `setLaunchImage`) to aid the creation of the alert parameters. For applications which provide Newsstand capability there is a new boolean parameter `note.newsstandAvailable` to specify `content-available` in the payload.

The above options will compile the following dictionary to send to the device:

	{"messageFrom":"Caroline","aps":{"badge":3,"sound":"ping.aiff","alert":"You have a new message"}}
	
**\*N.B.:** If you wish to send notifications containing emoji or other multi-byte characters you will need to set `note.encoding = 'ucs2'`. This tells node to send the message with 16bit characters, however it also means your message payload will be limited to 127 characters.
	
### Handling Errors

If the enhanced binary interface is enabled and an error occurs - as defined in Apple's documentation - when sending a message, then subsequent messages will be automatically resent* and the connection will be re-established. If an `errorCallback` is also specified in the connection options then it will be invoked with 2 arguments `(err, notification)`. Alternatively it is possible to specify an error callback function on a notification-by-notification basis by setting the ```.errorCallback``` property on the notification object to the callback function before sending.

**\*N.B.:** As of v1.2.5 a new events system has been implemented to provide more feedback to the application on the state of the connection. At present the ```errorCallback``` is still called in the following cases in addition to the new event system. It is strongly recommended that you migrate your application to use the new event system as the existing overloading of the ```errorCallback``` method will be deprecated and removed in future versions.

If a notification fails to be sent because a connection error occurs then the `errorCallback` will be called for each notification waiting for the connection which failed. In this case the first parameter will be an Error object instead of an error number.

`errorCallback` will be called in 3 situations with the parameters shown.

1. The notification has been rejected by Apple (or determined to have an invalid device token or payload before sending) for one of the reasons shown in Table 5-1 [here][errors] `errorCallback(errorCode, notification)`
1. A notification has been rejected by Apple but it has been removed from the cache so it is not possible to identify which. In this case subsequent notifications may be lost. **If this happens you should consider increasing your `cacheLength` value to prevent data loss** `errorCallback(255, null)`
1. A connection error has occurred before the notification can be sent. `errorCallback(Error object, notification)`

**\*N.B.:** The `cacheLength` option for the connection specifies the number of sent notifications which will be cached, on a FIFO basis for error handling purposes. If `cacheLength` is not set to a large enough value, then in high volume environments, a notification - possibly including some subsequent notifications - may be removed from the cache before Apple returns an error associated with it. In this case the `errorCallback` will still be called, but with a `null` notification and error code 255. If this happens you should consider increasing `cacheLength` to prevent losing notifications. All the notifications still residing in the cache will be resent automatically.

### Events emitted by the connection

The following events have been introduced as of v1.2.5 to allow closer monitoring and information about the internal processes in node-apn. If the events are not useful to you they can all be safely ignored (with the exception of ```error``` which indicates a failure to load the security credentials) and no action needs to be taken on your part when events are emitted. The ```disconnected``` event, for instance, is provided for informational purposes, the library will automatically re-establish the connection as necessary. The events are emitted by the connection itself so you should use ```apnsConnection.on('error', errorHandler)``` to attach listeners.

####Events (arguments):

- ```error (error)```: emitted when an error occurs during initialisation of the module, usually due to a problem with the keys and certificates.

- ```transmitted (notification)```: emitted when a notification has been sent to Apple - not a guarantee that it has been accepted by Apple, an error relating to it make occur later on. A notification may also be sent several times if an earlier notification caused an error requiring retransmission.

- ```timeout```: emitted when the connectionTimeout option has been specified and no activity has occurred on a socket for a specified duration. The socket will be closed immediately after this event.

- ```connected```: emitted when the connection to Apple is successfully established. No action is required as the connection is managed internally.

- ```disconnected```: emitted when the connection to Apple has been closed, this could be for numerous reasons, for example an error has occurred or the connection has timed out. No action is required.

- ```socketError (error)```: emitted when the connection socket experiences an error. This is useful for debugging but no action should be necessary.

- ```transmissionError (error code, notification)```: emitted when a message has been received from Apple stating that a notification was invalid. If we still have the notification in cache it will be passed as the second argument, otherwise null.

- ```cacheTooSmall (difference)```: emitted when Apple returns a notification as invalid but the notification has been expunged from the cache - usually due to high throughput. The parameter estimates how many notifications have been lost. You should experiment with increasing the cache size or enabling ```autoAdjustCache``` if you see this frequently. Note: With ```autoAdjustCache``` enabled this event will still be emitted when an adjustment is triggered.

### Setting up the feedback service

Apple recommends checking the feedback service periodically for a list of devices for which there were failed delivery attempts.

Using the `Feedback` object it is possible to periodically query the server for the list. You should provide a function `feedback` which will accept two arguments, the `time` returned by the server (epoch time) and a `Buffer` object containing the device token. You can also set the query interval in seconds. The default options are shown below.

	var options = {
		cert: 'cert.pem',                   /* Certificate file */
		certData: null,                     /* Certificate file contents (String|Buffer) */
		key:  'key.pem',                    /* Key file */
		keyData: null,                      /* Key file contents (String|Buffer) */
		passphrase: null,                   /* A passphrase for the Key file */
		ca: null,							/* Certificate authority data to pass to the TLS connection */
		pfx: null,							/* File path for private key, certificate and CA certs in PFX or PKCS12 format. If supplied will be used instead of certificate and key above */
		pfxData: null,						/* PFX or PKCS12 format data containing the private key, certificate and CA certs. If supplied will be used instead of loading from disk. */
		address: 'feedback.push.apple.com', /* feedback address */
		port: 2196,                         /* feedback port */
		feedback: false,                    /* enable feedback service, set to callback */
		batchFeedback: false,				/* if feedback should be called once per connection. */
		interval: 3600                      /* interval in seconds to connect to feedback service */
	};

	var feedback = new apns.Feedback(options);

This will automatically start a timer to check with Apple every `interval` seconds. You can cancel the interval by calling `feedback.cancel()`. If you do not wish to have the service automatically queried then set `interval` to 0 and use `feedback.start()`.

**Important:** In a development environment you must set `address` to `feedback.sandbox.push.apple.com`.

More information about the feedback service can be found in the [feedback service documentation][fs].

## Converting your APNs Certificate

After requesting the certificate from Apple, export your private key as a .p12 file and download the .cer file from the iOS Provisioning Portal.

Now, in the directory containing cert.cer and key.p12 execute the following commands to generate your .pem files:

	$ openssl x509 -in cert.cer -inform DER -outform PEM -out cert.pem
	$ openssl pkcs12 -in key.p12 -out key.pem -nodes
	
If you are using a development certificate you may wish to name them differently to enable fast switching between development and production. The filenames are configurable within the module options, so feel free to name them something more appropriate.

It is also possible to supply a PFX package containing your certificate, key and any relevant CA certificates. The method to accomplish this is left as an exercise to the reader.

## Debugging

If you experience difficulties sending notifications or using the feedback service you can enable debug messages within the library by running your application with `DEBUG=apn` or `DEBUG=apnfb` set as an environment variable.

You will need the `debug` module which can be installed with `npm install debug`.

## Credits

Written and maintained by [Andrew Naylor][andrewnaylor].

Thanks to: [Ian Babrou][bobrik], [dgthistle][dgthistle], [Keith Larsen][keithnlarsen], [Mike P][mypark], [Greg Bergé][neoziro], [Asad ur Rehman][AsadR], [Nebojsa Sabovic][nsabovic], [Alberto Gimeno][gimenete], [Randall Tombaugh][rwtombaugh]

## License

Released under the MIT License

Copyright (c) 2010 Andrew Naylor

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[errors]:https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CommunicatingWIthAPS/CommunicatingWIthAPS.html#//apple_ref/doc/uid/TP40008194-CH101-SW4 "The Binary Interface and Notification Formats"
[pl]: https://developer.apple.com/library/ios/#documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/ApplePushService/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW1 "Local and Push Notification Programming Guide: Apple Push Notification Service"
[fs]:https://developer.apple.com/library/ios/#documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CommunicatingWIthAPS/CommunicatingWIthAPS.html#//apple_ref/doc/uid/TP40008194-CH101-SW3 "Communicating With APS"
[andrewnaylor]: http://andrewnaylor.co.uk
[bnoordhuis]: http://bnoordhuis.nl
[npm]: https://github.com/isaacs/npm
[bobrik]: http://bobrik.name
[dgthistle]: https://github.com/dgthistle
[keithnlarsen]: https://github.com/keithnlarsen
[mypark]: https://github.com/mypark
[neoziro]: https://github.com/neoziro
[AsadR]: https://github.com/AsadR
[nsabovic]: https://github.com/nsabovic
[gimenete]: https://github.com/gimenete
[rwtombaugh]: https://github.com/rwtombaugh
[q]: https://github.com/kriskowal/q

## Changelog

1.2.5:

* Introduced a new event model. The connection class is now an event emitter which will emit events on connection state changes. This should largely replace the existing, somewhat inadequate error handling in previous versions. Please see the section above for more details or the message on commit d0a1d17961
* Fixed a bug relating to rejecting unauthorized hosts
* Added support for PFX files instead of separate Certificate and Key Files
* Added a batched feedback feature which can callback with an array of all devices instead of calling the method for each device separately
* Added support for error callbacks on a per notification basis.
* Changed the socket behaviour to enable the TCP Nagle algorithm as recommended by Apple
* Fixed lots of small bugs around connection handling which should make high volume applications more stable. Node should no longer crash completely on EPIPE errors.
* Added connection socket timeout after a period of inactivity, configured by ```options.connectionTimeout```. The socket will then be re-established automatically if further notifications are sent.
* Added cache autoadjustment. If ```options.autoAdjustCache = true``` and a notification error occurs after the notification is purged from the cache the library will attempt to increase the cache size to prevent it happening in future.

1.2.4:

* Fixed some typos in the feedback methods
* Added some debug messages available during development, see debug section above.

1.2.3:

* Added some more error handling to the connection methods.
* Fixed a problem where an error handler was not bound to the correct context and wouldn't fire.

1.2.2:

* Fixes issue #47, Syntax Error in feedback.js

1.2.1:

* Earlier versions had some incorrect logic in the handling of reconnection. This should be fixed now
* Issue #46 ```.clone()``` did not set the badge property correctly.

1.2.0:

* Complete rewrite of the connection handling.
* [q][q] is now required.
* Change in the error handling logic. When a notification errors and it cannot be found in the cache, then all notifications in the cache will be resent instead of being discarded.
* `errorCallback` will also be invoked for connection errors.
* New methods on `Notification` to aid settings the alert properties.
* `content-available` can now be set for Newsstand applications by setting the `newsstandAvailable` property on the Notification object.
* `Notification` objects now have a `.clone(device)` method to assist you in sending the same notification to multiple devices.
* Included some js-doc tags in the source.
* Device object now provides a `.toString()` method to return the hex representation of the device token.
* Fixes #23, #28, #32, #34, #35, #40, #42

1.1.7:

* Fixes a problem with sockets being closed on transmission error causing EPIPE errors in node.
* Issues #29, #30

1.1.6:

* Fixes a regression from v1.1.5 causing connections to stall and messages to not be sent.

1.1.5:

* Feature: Certificate and Key data can be passed directly when creating a new connection instead of providing a file name on disk. (See: `certData` and `keyData` options)
* Deliver whole write buffer if the socket is ready.
* Fixed some global memory leaks.
* Tidied up some code formatting glitches flagged by jslint
* Fixes #16, #17, #18, #19, #20

1.1.4:

* Fixes #15: Sending unified emoji via apn; Added encoding parameter when sending notification

1.1.3:

* Fixes #11,#12,#13,#14: Ensure delivery of notifications to Apple even under heavy load.

1.1.2:

* Fixes #9, Addresses an issue if the socket disconnects with queued notifications it would be reinitialised before its teardown is completed leaving the system in an undefined state.

1.1.1:

* Fixes issue #6 where a socket emitting an error could bring down the whole node instance as the exception is uncaught.

1.1.0:

* First shot at node-0.4.0 compatibility with new tls API.
* Fixed a bug with parsing device token which could cause an out-of-bounds error.

1.0.4:

* The 1.0.x tree is now a maintenance branch as the TLS API used has been deprecated as of node 0.4.0
* Changed package.json to specify the inoperability of this version with node > 0.4.0

1.0.3:

* Fixes a typo in the documentation in this very file

1.0.2:

* Fixes critical issue with error callback not firing (Issue #1)

1.0.1:

* Moved some object methods into the prototype to save memory
* Tidied up some connecting code
* Introduced an `index.js` to make module loading tidier
* Fixed a couple of typos. 

1.0.0: 
 
* Well I created a module; Version 0.0.0 had no code, and now it does, and it works, so that's pretty neat, right?

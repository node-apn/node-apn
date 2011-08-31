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
	
As a submodule of your project

	$ git submodule add http://github.com/argon/node-apn.git apn
	$ git submodule update --init

## Usage
### Load in the module

	var apns = require('apn');
	
### Connecting
Create a new connection to the gateway server using a dictionary of options. The defaults are listed below:

	options =   { cert: 'cert.pem' /* Certificate file */
				, key:	'key.pem'  /* Key file */
				, gateway: 'gateway.push.apple.com' /* gateway address */
				, port: 2195 /* gateway port */
				, enhanced: true /* enable enhanced format */
				, errorCallback: undefined /* Callback when error occurs */
				, cacheLength: 5 /* Notifications to cache for error purposes */
				};
	
	var apnsConnection = new apns.connection(options);

### Sending a notification
To send a notification first create a `Device` object. Pass it the device token as either a hexadecimal string, or alternatively as a `Buffer` object containing the binary token, setting the second argument to `false`.

	var myDevice = new apns.device(token /*, ascii=true*/);

Next create a notification object and set parameters. See the [payload documentation][pl] for more details

	var note = new apns.notification();
	
	note.badge = 3;
	note.sound = "ping.aiff";
	note.alert = "You have a new message";
	note.payload = {'messageFrom': 'Caroline'};
	note.device = myDevice;
	
	apnsConnection.sendNotification(note);
	
The above options will compile the following dictionary to send to the device:

	{"messageFrom":"Caroline","aps":{"badge":3,"sound":"ping.aiff","alert":"You have a new message"}}
	
### Handling Errors

If the enhanced binary interface is enabled and an error occurs when sending a message then subsequent messages will be automatically resent* and the connection will be re-established. If an `errorCallback` is also specified in the connection options then it will be invoked with 2 arguments.

1. The error number as returned from Apple. This can be compared to the predefined values in the `Errors` object.
1. The notification object as it existed when the notification was converted and sent to the server.

\* N.B.: The `cacheLength` option specifies the number of sent notifications which will be cached for error handling purposes. At present if more than the specified number of notifications have been sent between the incorrect notification being sent and the error being received then no resending will occur. This is only envisaged within very high volume environments and a higher cache number might be desired.
### Setting up the feedback service

Apple recommends checking the feedback service periodically for a list of devices for which there were failed delivery attempts.

Using the `Feedback` object it is possible to periodically query the server for the list. You should provide a function which will accept two arguments, the `time` returned by the server (epoch time) and a `Device` object containing the device token. You can also set the query interval in seconds. Again the default options are shown below.

	options =	{ cert: 'cert.pem' /* Certificate file */
				, key:	'key.pem'  /* Key file */
				, address: 'feedback.push.apple.com' /* feedback address */
				, port: 2196 /* feedback port */
				, feedback: false /* callback function */
				, interval: 3600 /* query interval in seconds */
				};

	var feedback = new apns.feedback(options);

## Converting your APNs Certificate

After requesting the certificate from Apple export your private key as a .p12 file and download the .cer file from the iOS Provisioning Portal.

Now in the directory containing cert.cer and key.p12 execute the following commands to generate your .pem files:

	$ openssl x509 -in cert.cer -inform DER -outform PEM -out cert.pem
	$ openssl pkcs12 -in key.p12 -out key.pem -nodes
	
If you are using a development certificate you may wish to name them differently to enable fast switching between development and production. The filenames are configurable within the module options, so feel free to name them something more appropriate.

## Credits

Written and maintained by [Andrew Naylor][mphys].

Special thanks to [Ben Noordhuis][bnoordhuis] for `invoke_after` code.

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

[pl]: https://developer.apple.com/library/ios/#documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/ApplePushService/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW1 "Local and Push Notification Programming Guide: Apple Push Notification Service"
[mphys]: http://mphys.com
[bnoordhuis]: http://bnoordhuis.nl
[npm]: http://github.com/isaacs/npm

## Changelog

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
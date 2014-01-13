# APN

node-apn provides a non-blocking, fully managed interface to push notifications to iOS devices using the Apple Push Notification System.

To use the APN Module one must `require('apn')`.

If you are not familiar with how the Apple Push Notificaion System (APNS) works, it is recommended that you read the [Local and Push Notification Programming Guide][pg] in particular the section on [A Push Notification and Its Path][pnpath].


### Sending a Push Notification

Sending push notifications is as simple as creating a new connection to APNS using the `Connection` class which should be configured, at minimum, with your applications' certificate and private key. The `Connection` class manages underlying sockets automatically.

Pushing a notification to a device is as simple as creating an instance of `Notification` which you then configure with the payload and call `Connection#pushNotification` with the notification object and the device token you wish to send it to. It is also possible to send the same notification object to multiple devices very efficiently please consult the documentation for `Connection#pushNotification` for more details.

The status of the `Connection` object, including underlying connections, can be observed by the events emitted. It is particularly important that you read the section below on *Handling Errors*.

### Monitoring the Feedback Service.

Apple provides the "Feedback Service" to inform you when devices you have attempted to send notifications to are no longer reachable - usually because the app has been deleted from the users device. The `Feedback` class will handle connecting to the Feedback service periodically and providing the results to your application for processing. More information on the correct usage of the Feedback service is included below.

## apn.Connection([options])

Creates a new connection to the Apple Push Notification Service.

Options:

 - `cert` {String} The filename of the connection certificate to load from disk (Defaults to: `cert.pem`)

 - `certData` {Buffer|String} The certificate data. If supplied, will be used instead of loading from disk.

 - `key` {String} The filename of the connection key to load from disk (Defaults to:  `key.pem`)

 - `keyData` {Buffer|String} The key data. If supplied will be used instead of loading from disk.

 - `ca` An Array of Strings or Buffers of trusted certificates. If this is omitted several well known "root" CAs will be used, like VeriSign. - You may need to use option, this as some environments don't include the CA used by Apple.

 - `pfx` {String} File path for private key, certificate and CA certs in PFX or PKCS12 format. If supplied will be used instead of certificate and key above

 - `pfxData` {Buffer|String} PFX or PKCS12 format data containing the private key, certificate and CA certs. If supplied will be used instead of loading from disk.

 - `passphrase` {String} The passphrase for the connection key, if required

 - `address` {String `gateway.push.apple.com`} The gateway server to connect to.

 - `port` {Number} Gateway port (Defaults to: `2195`)

 - `rejectUnauthorized` {Boolean} Reject Unauthorized property to be passed through to tls.connect() (Defaults to `true`)

 - `enhanced` {Boolean} Whether to use the enhanced notification format (recommended, defaults to: `true`)

 - `cacheLength` {Number} Number of notifications to cache for error purposes (See "Handling Errors" below, (Defaults to: 100)

 - `autoAdjustCache` {Boolean} Whether the cache should grow in response to messages being lost after errors. (Will still emit a 'cacheTooSmall' event) (Defaults to: `false`)

 - `maxConnections` {Number} The maximum number of connections to create for sending messages. (Defaults to: `1`)

 - `connectionTimeout` {Number} The duration the socket should stay alive with no activity in milliseconds. 0 = Disabled. (Defaults to: `0`)

 - `buffersNotifications` {Boolean} Whether to buffer notifications and resend them after failure. (Defaults to: `true`)

 - `fastMode` {Boolean} Whether to aggresively empty the notification buffer while connected - if set to true node-apn may enter a tight loop under heavy load while delivering notifications. (Defaults to: `false`)

 - `legacy` {Boolean} Whether to use the pre-iOS 7 protocol format. (Defaults to `false`)

 **Important:** In a development environment you must set `address` to `gateway.sandbox.push.apple.com`.

## apn.Feedback([options])

Creates a new connection to the Apple Push Notification Feedback Service and if `interval` isn't disabled automatically begins polling the service. Many of the options are the same as `apn.Connection()`

Attach an event to the `feedback` event to receive output.

- `cert` {String} The filename of the connection certificate to load from disk (Defaults to: `cert.pem`)

 - `certData` {Buffer|String} The certificate data. If supplied, will be used instead of loading from disk.

 - `key` {String} The filename of the connection key to load from disk (Defaults to:  `key.pem`)

 - `keyData` {Buffer|String} The key data. If supplied will be used instead of loading from disk.

 - `ca` An Array of Strings or Buffers of trusted certificates. If this is omitted several well known "root" CAs will be used, like VeriSign. - You may need to use option, this as some environments don't include the CA used by Apple.

 - `pfx` {String} File path for private key, certificate and CA certs in PFX or PKCS12 format. If supplied will be used instead of certificate and key above

 - `pfxData` {Buffer|String} PFX or PKCS12 format data containing the private key, certificate and CA certs. If supplied will be used instead of loading from disk.

 - `passphrase` {String} The passphrase for the connection key, if required

 - `address` {String `feedback.push.apple.com`} The feedback server to connect to.

 - `port` {Number} Feedback server port (Defaults to: `2196`)

 - `rejectUnauthorized` {Boolean} Reject Unauthorized property to be passed through to tls.connect() (Defaults to `true`)

 - `batchFeedback` {Boolean} Sets the behaviour for triggering the `feedback` event. When `true` the event will be triggered once per connection with an array of timestamp and device token tuples. Otherwise a `feedback` event will be emitted once per token received. (Defaults to: true)

 - `batchSize` {Number} The maximum number of tokens to pass when emitting the event - a value of 0 will cause all tokens to be passed after connection is reset. After this number of tokens are received the `feedback` event will be emitted. (Only applies when `batchFeedback` is enabled)

 - `interval` {Number} How often to automatically poll the feedback service. Set to `0` to disable. (Defaults to: `3600`)

**Important:** In a development environment you must set `address` to `feedback.sandbox.push.apple.com`.

## apn.Device(deviceToken)

Returns a new `Device` object. `deviceToken` can be a `Buffer` or a `String` containing a "hex" representation of the token. Throws an error if the deviceToken supplied is invalid.

## apn.Notification([payload])

Returns a new `Notification` object. You can optionally pass in an object representing the payload, or configure properties on the returned object. See below.

## Class: apn.Connection

### connection.pushNotification(notification, recipient)

This is the business end of the module. Create a `Notification` object and pass it in, along with a single recipient or an array of them and node-apn will take care of the rest, delivering the notification to each recipient.

A "recipient" is either a `Device` object, a `String`, or a `Buffer` containing the device token. `Device` objects are used internally and will be created if necessary. Where applicable, all events will return a `Device` regardless of the type passed to this method.

#### A note on Unicode.

If you wish to send notifications containing emoji or other multi-byte characters you will need to ensure they are encoded correctly within the string. Notifications can be transmitted to Apple in either UTF-8 or UTF-16 and strings passed in for the Alert will be converted accordingly. UTF-8 is recommended for most cases as it can represent exactly the same characters as UTF-16 but is usually more space-efficient. When manually encoding strings as above with `\uD83D\uDCE7` the character (in this case a surrogate pair) is escaped in UTF-16 form because Javascript uses UTF-16 internally for Strings but does not handle surrogate pairs automatically.

If in doubt, leave the encoding as default. If you experience any problems post a question in the [node-apn Google Group][googlegroup].

### connection.setCacheLength(newLength)

Used to manually adjust the "cacheLength" property in the options. This is ideal if you choose to use the `cacheTooSmall` event to tweak your environment. It is safe for increasing and reducing cache size.

### connection.shutdown()

Indicate to node-apn that when the queue of pending notifications is fully drained that it should close all open connections. This will mean that if there are no other pending resources (open sockets, running timers, etc.) the application will terminate. If notifications are pushed after the connection has completely shutdown a new connection will be established and, if applicable, `shutdown` will need to be called again.

### Event: 'error'

`function (error) { }`

Emitted when an error occurs during initialisation of the module, usually due to a problem with the keys and certificates.

### Event: 'socketError'

`function (error) { }`

Emitted when the connection socket experiences an error. This may be useful for debugging but no action should be necessary.

### Event: 'transmitted'

`function (notification, device) { }`

Emitted when a notification has been sent to Apple - not a guarantee that it has been accepted by Apple, an error relating to it may occur later on. A notification may also be "transmitted" several times if a preceding notification caused an error requiring retransmission.

### Event: 'cacheTooSmall'

`function (sizeDifference) { }`

Emitted when Apple returns a notification as invalid but the notification has already been expunged from the cache - usually due to high throughput and indicates that notifications will be getting lost. The parameter is an estimate of how many notifications have been lost. You should experiment with increasing the cache size or enabling ```autoAdjustCache``` if you see this frequently.

**Note**: With ```autoAdjustCache``` enabled this event will still be emitted when an adjustment is triggered.

### Event: 'connected'

`function (openSockets) { }`

Emitted when a connection to Apple is successfully established. The parameter indicates the number of open connections. No action is required as the connection is managed internally.

### Event: 'disconnected'

`function (openSockets) { }`

Emitted when the connection to Apple has been closed, this could be for numerous reasons, for example an error has occurred or the connection has timed out. The parameter is the same as for `connected` and again, no action is required.

### Event: 'timeout'

`function() { }`

Emitted when the connectionTimeout option has been specified and no activity has occurred on a socket for a specified duration. The socket will be closed immediately after this event and a `disconnected` event will also be emitted.

### Event: 'transmissionError'

`function(errorCode, notification, device) { }`

Emitted when a message has been received from Apple stating that a notification was invalid or if an internal error occurred before that notification could be pushed to Apple. If the notification is still in the cache it will be passed as the second argument, otherwise null. Where possible the associated `Device` object will be passed as a third parameter, however in cases where the token supplied to the module cannot be parsed into a `Buffer` the supplied value will be returned.

Error codes smaller than 512 correspond to those returned by Apple as per their [docs][errors]. Other errors are applicable to `node-apn` itself. Definitions can be found in `lib/errors.js`.

For further information please read the section below on "Handling Errors".


## Class: apn.Notification

As of version 1.2.0 it is possible to use a set of methods provided by Notification object (`setAlertText`, `setActionLocKey`, `setLocKey`, `setLocArgs`, `setLaunchImage`) to aid the creation of the alert parameters. For applications which provide Newsstand capability there is a new boolean parameter `note.newsstandAvailable` to specify `content-available` in the payload.

For iOS 7 applications which support Silent Remote Notifications you can use the `note.contentAvailable` property. This is identical in functionality to  `note.newsstandAvailable` without the confusion of the "Newstand" terminology.

A `Notification` enapsulates the data to be compiled down to JSON and pushed to a device. See the [payload documentation][pl] for more details. At present the total length of the payload accepted by Apple is 256 bytes.

### notification.retryLimit

The maximum number of retries which should be performed when sending a notification if an error occurs. A value of 0 will only allow one attempt at sending (0 retries). Set to -1 to disable (default).

### notification.expiry

The UNIX timestamp representing when the notification should expire. This does not contribute to the 256 byte payload size limit. An expiry of 0 indicates that the notification expires immediately.

### notification.priority

From [Apples' Documentation][notificationFormat], Provide one of the following values:

  * 10 - The push message is sent immediately. (Default)
    > The push notification must trigger an alert, sound, or badge on the device. It is an error use this priority for a push that contains only the content-available key.
  * 5 - The push message is sent at a time that conserves power on the device receiving it.

This value is not valid when the connection is in legacy mode.

### notification.encoding

The encoding to use when transmitting the notification to APNS, defaults to `utf8`. `utf16le` is also possible but as each character is represented by a minimum of 2 bytes, will at least halve the possible payload size. If in doubt leave as default.

### notification.payload

This object represents the root JSON object that you can add custom information for your application to. The properties below will only be added to the payload (under `aps`) when the notification is prepared for sending.

### notification.badge

The value to specify for `payload.aps.badge`

### notification.sound

The value to specify for `payload.aps.sound`

### notification.alert

The value to specify for `payload.aps.alert` can be either a `String` or an `Object` as outlined by the payload documentation.

### notification.newsstandAvailable
### notification.contentAvailable

Setting either of these properties to true will specify "content-available" in the payload when it is compiled.

### notification.mdm

The value to specify for the `mdm` field where applicable.

### notification.urlArgs

The value to specify for `payload.aps['url-args']`. This used for Safari Push NOtifications and should be an array of values in accordance with the [Web Payload Documentation][webpayloaddocs].

### notification.truncateAtWordEnd

When this parameter is set and `notification#trim()` is called it will attempt to truncate the string at the nearest space.

### notification.setAlertText(alert)

Set the `aps.alert` text body. This will use the most space-efficient means.

### notification.setActionLocKey(key)

Set the `action-loc-key` property of the `aps.alert` object.

### notification.setLocKey(key)

Set the `loc-key` property of the `aps.alert` object.

### notification.setLocArgs(args)

Set the `loc-args` property of the `aps.alert` object.

### notification.setLaunchImage(image)

Set the `launch-image` property of the `aps.alert` object.

### notification.setMDM(mdm)

Set the `mdm` property on the payload.

### notification.setNewsstandAvailable(available)
### notification.setContentAvailable(available)

Set the `content-available` property of the `aps` object.

### notification.setUrlArgs(urlArgs)

Set the `url-args` property of the `aps` object.

### notification.trim()

Attempt to automatically trim the notification alert text body to meet the payload size limit of 256 bytes.


## Class: apn.Feedback

### feedback.start()

Trigger a query of the feedback service. If `interval` is non-zero then this method will be called automatically.

### feedback.cancel()

 You can cancel the interval by calling `feedback.cancel()`. If you do not wish to have the service automatically queried then set `interval` to 0 and use `feedback.start()` to manually invoke it one time.

### Event: 'error'

`function (error) { }`

Emitted when an error occurs initialising the module. Usually caused by failing to load the certificates.

### Event: 'feedbackError'

`function (error) { }`

Emitted when an error occurs receiving or processing the feedback and in the case of a socket error occurring. These errors are usually informational and node-apn will automatically recover.

### Event: 'feedback'

`function (feedbackData) { }`

Emitted when data has been received from the feedback service, typically once per connection. `feedbackData` is an array of objects, each containing the `time` returned by the server (epoch time) and the `device` a `Buffer` containing the device token.

If `batchFeedback` has been disabled this will be emitted once per item, with two parameters, the `time` and the `device`.

### Using the feedback data:

The documentation on [The Feedback Service][feedback] explains how you should use the data emitted from the 'feedback' event. The most important part is quoted here:

> Query the feedback service daily to get the list of device tokens. Use the timestamp to verify that the device tokens haven’t been reregistered since the feedback entry was generated. For each device that has not been reregistered, stop sending notifications. APNs monitors providers for their diligence in checking the feedback service and refraining from sending push notifications to nonexistent applications on devices.

Typically you should record the timestemp when a device registers with your service along with the token and update it every time your app re-registers the token. When the feedback service returns a token with an associated timestamp which is newer than that stored by you then you should disable, or remove, the token from your system and stop sending notifications to it.

## Handling Errors

When an error occurs while pushing a notification and the enhanced interface is enabled, Apple sends a message back to node-apn containing the "identifier" of the notification which caused the error and an associated error code (See: [The Binary Interface and Notification Formats][errors]). Apple does not return the entire message so node-apn caches a number of notifications after they are sent, so in the event an error occurs node-apn can find the one with the correct identifier from the cache and trigger the `transmissionError` event with the appropriate `Notification` object and `Device` it should have been delivered to.

Apple guarantees that if one notification causes an error none of the following notifications will be processed, so if node-apn can find the correct notification which caused the error in the cache, then it can automatically re-send all the ones afterward.

It's not a good idea to cache notifications indefinitely because after a certain length of time has passed we can be confident that Apple have received the notification without problem so it is implemented as a fixed size FIFO queue internally. Depending on how high-volume your environment is it's possible that many notifications will be successfully sent to Apple before the error response is sent.

The cache size defaults to 100 which will have neglible impact on memory usage and will suit low-volume environments. Testing has shown that an error response can take as long as 200ms, while the module has proven the ability to send over 5000 notifications per second, so it may necessary to increase the size of the cache to ensure node-apn can find the problematic one and resend all the following ones. The `autoAdjustCache` option is designed to address this problem but it risks losing notifications until the size has automatically increased accordingly, for best results manual adjustment according to your requirements is recommended.

If the cache is too small then node-apn wont be able to return the bad notification to through the `transmissionError` event and will pass `null` instead. The module _will_ resend all notifications in the cache but some may have been lost between the bad notification and the first one in the cache.

If you wish to disable the automatic resending functionality please consult the `buffersNotifications` configuration option.

[googlegroup]:https://groups.google.com/group/node-apn "node-apn Google Group"
[pg]:https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Introduction.html#//apple_ref/doc/uid/TP40008194-CH1-SW1 "Local and Push Notification Programming Guide"
[pnpath]:https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW10 "A Push Notification and Its Path"
[errors]:https://developer.apple.com/library/ios/#documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/CommunicatingWIthAPS.html#//apple_ref/doc/uid/TP40008194-CH101-SW4 "The Binary Interface and Notification Formats"
[feedback]:https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/CommunicatingWIthAPS.html#//apple_ref/doc/uid/TP40008194-CH101-SW3 "The Feedback Service"
[pl]:https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW1 "Local and Push Notification Programming Guide: Apple Push Notification Service"
[notificationFormat]:https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/CommunicatingWIthAPS.html#//apple_ref/doc/uid/TP40008194-CH101-SW9 "The Binary Interface and Notification Format"
[webpayloaddocs]:https://developer.apple.com/library/prerelease/mac/documentation/NetworkingInternet/Conceptual/NotificationProgrammingGuideForWebsites/PushNotifications/PushNotifications.html#//apple_ref/doc/uid/TP40013225-CH3-SW12 "Configuring Safari Push Notifications"

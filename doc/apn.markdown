# APN

node-apn provides a non-blocking, fully managed interface to push notifications to iOS devices using the Apple Push Notification System.


To use the APN Module one must `require('apn')`.

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

 - `gateway` {String `gateway.push.apple.com`} The gateway server to connect to.

 - `port` {Number} Gateway port (Defaults to: `2195`)

 - `rejectUnauthorized` {Boolean} Reject Unauthorized property to be passed through to tls.connect() (Defaults to `true`)

 - `enhanced` {Boolean} Whether to use the enhanced notification format (recommended, defaults to: `true`)

 - `cacheLength` {Number} Number of notifications to cache for error purposes (See "Handling Errors" below, (Defaults to: 100)

 - `autoAdjustCache` {Boolean} Whether the cache should grow in response to messages being lost after errors. (Will still emit a 'cacheTooSmall' event) (Defaults to: `false`)

 - `maxConnections` {Number} The maximum number of connections to create for sending messages. (Defaults to: `1`)

 - `connectionTimeout` {Number} The duration the socket should stay alive with no activity in milliseconds. 0 = Disabled. (Defaults to: `0`)

 - `buffersNotifications` {Boolean} Whether to buffer notifications and resend them after failure. (Defaults to: `true`)

 - `fastMode` {Boolean} Whether to aggresively empty the notification buffer while connected - if set to true node-apn may enter a tight loop under heavy load while delivering notifications. (Defaults to: `false`)

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

 - `gateway` {String `feedback.push.apple.com`} The gateway server to connect to.

 - `port` {Number} Gateway port (Defaults to: `2196`)

 - `rejectUnauthorized` {Boolean} Reject Unauthorized property to be passed through to tls.connect() (Defaults to `true`)

 - `batchFeedback` {Boolean} Whether to use the enhanced notification format (recommended, defaults to: `true`)

 - `interval` {Number} How often to automatically poll the feedback service. Set to `0` to disable. (Defaults to: `3600`)

## apn.Device(deviceToken)

Returns a new `Device` object. `deviceToken` can be a `Buffer` or a `String` containing a "hex" representation of the token.

## apn.Notification([payload])

Returns a new `Notification` object. You can optionally pass in an object representing the payload, or configure properties on the returned object. See below.

## Class: apn.Connection

### connection.pushNotification(notification, recipient)

This is the business end of the module. Create a `Notification` object and pass it in, along with a single recipient or an array of them and node-apn will take care of the rest, delivering the notification to each recipient. 

A "recipient" is either a `Device` object, a `String`, or a `Buffer` containing the device token. `Device` objects are used internally and will be created if necessary. Where applicable, all events will return a `Device` regardless of the type passed to this method.


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

Emitted when a message has been received from Apple stating that a notification was invalid. If the notification is still in the cache it will be passed as the second argument, otherwise null. 

For further information please read the section below on "Handling Errors".


## Class: apn.Notification

As of version 1.2.0 it is possible to use a set of methods provided by Notification object (`setAlertText`, `setActionLocKey`, `setLocKey`, `setLocArgs`, `setLaunchImage`) to aid the creation of the alert parameters. For applications which provide Newsstand capability there is a new boolean parameter `note.newsstandAvailable` to specify `content-available` in the payload.

A `Notification` enapsulates the data to be compiled down to JSON and pushed to a device. See the [payload documentation][pl] for more details. At present the total length of the payload accepted by Apple is 256 bytes.

### notification.expiry 

The UNIX timestamp representing when the notification should expire. This does not contribute to the 256 byte payload size limit.

### notification.encoding

The encoding to use when transmitting the notification to APNS, defaults to `utf8`. `utf16le` is also possible but as each character is represented by a minimum of 2 bytes, will at least halve the possible payload size. If in doubt leave as default.

### notification.payload

This object represents the root JSON object that you can add custom information for your application to. The properties below will only be added to the payload (under `aps`) when the notification is prepared for sending. 


### notification.badge

The value to specify for `payload.aps.badge`

### notification.sound

The value to specify for `payload.aps.sound`

### notification.alert 

The value to specify for `payload.apns.alert` can be either a `String` or an `Object` as outlined by the payload documentation.

### notification.newsstandAvailable

Setting this property to true will specify "content-available" in the payload when it is compiled.

### notification.mdm

The value to specify for the `mdm` field where applicable.

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

### notification.trim()

Attempt to automatically trim the notification alert text body to meet the payload size limit of 256 bytes.


## Class: apn.Feedback

### feedback.start()

Trigger a query of the feedback service. If `interval` is non-zero then this method will be called automatically.

### feedback.cancel()

 You can cancel the interval by calling `feedback.cancel()`. If you do not wish to have the service automatically queried then set `interval` to 0 and use `feedback.start()` to manually invoke it one time.

### Event: 'error'

`function (error) { }`

Emitted when an error occurs establishing a connection the feedback servers.

### Event: 'feedback'

`function (feedbackData) { }`

Emitted when data has been received from the feedback service, typically once per connection. `feedbackData` is an array of objects, each containing the `time` returned by the server (epoch time) and the `device` a `Buffer` containing the device token. 

If `batchFeedback` has been disabled this will be emitted once per item, with two parameters, the `time` and the `device`.

## Handling Errors

When an error occurs while pushing a notification and the enhanced interface is enabled Apple sends a message back to node-apn containing the "identifier" of the notification which caused the error and an associated error code (See: [The Binary Interface and Notification Formats][errors]). Apple does not return the entire message so node-apn caches a number of notifications after they are sent, so in the event an error occurs node-apn can find the one with the correct identifier from the cache and trigger the `transmissionError` event with the appropriate `Notification` object and `Device` it should have been delivered to.

Apple guarantees that if one notification causes an error none of the following notifications will be processed, so if node-apn can find the correct notification which caused the error in the cache, then it can automatically re-send all the ones afterward.

It's not a good idea to cache notifications indefinitely because after a certain length of time has passed we can be confident that Apple have received the notification without problem so it is implemented as a fixed size FIFO queue internally. Depending on how high-volume your environment is it's possible that many notifications will be successfully sent to Apple before the error response is sent. 

The cache size defaults to 100 which will have neglible impact on memory usage and will suit low-volume environments. Testing has shown that an error response can take as long as 200ms, while the module has proven the ability to send over 5000 notifications per second, so it may necessary to increase the size of the cache to ensure node-apn can find the problematic one and resend all the following ones. The `autoAdjustCache` option is designed to address this problem but it risks losing notifications until the size has automatically increased accordingly, for best results manual adjustment according to your requirements is recommended.

If the cache is too small then node-apn wont be able to return the bad notification to through the `transmissionError` event and will pass `null` instead. The module _will_ resend all notifications in the cache but some may have been lost between the bad notification and the first one in the cache.

If you wish to disable the automatic resending functionality please consult the `buffersNotifications` configuration option.

[errors]:https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CommunicatingWIthAPS/CommunicatingWIthAPS.html#//apple_ref/doc/uid/TP40008194-CH101-SW4 "The Binary Interface and Notification Formats"
[pl]: https://developer.apple.com/library/ios/#documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/ApplePushService/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW1 "Local and Push Notification Programming Guide: Apple Push Notification Service"

## apn.Connection([options])

Creates a new connection to the Apple Push Notification Service.

Options:

 - `cert` {Buffer|String} TThe filename of the connection certificate to load from disk, or a Buffer/String containing the certificate data. (Defaults to: `cert.pem`)

 - `key` {Buffer|String} The filename of the connection key to load from disk, or a Buffer/String containing the key data. (Defaults to: `key.pem`)

 - `ca` An array of trusted certificates. Each element should contain either a filename to load, or a Buffer/String (in PEM format) to be used directly. If this is omitted several well known "root" CAs will be used. - You may need to use this as some environments don't include the CA used by Apple (entrust_2048).

 - `pfx` {Buffer|String} File path for private key, certificate and CA certs in PFX or PKCS12 format, or a Buffer containing the PFX data. If supplied will always be used instead of certificate and key above.

 - `passphrase` {String} The passphrase for the connection key, if required

 - `production` {Boolean} Specifies which environment to connect to: Production (if true) or Sandbox - The hostname will be set automatically. (Defaults to NODE_ENV == "production", i.e. false unless the NODE_ENV environment variable is set accordingly)

 - `voip` {Boolean} Enable when you are using a VoIP certificate to enable paylods up to 4096 bytes.

 - `port` {Number} Gateway port (Defaults to: `2195`)

 - `rejectUnauthorized` {Boolean} Reject Unauthorized property to be passed through to tls.connect() (Defaults to `true`)

 - `cacheLength` {Number} Number of notifications to cache for error purposes (See "Handling Errors" below, (Defaults to: 1000)

 - `autoAdjustCache` {Boolean} Whether the cache should grow in response to messages being lost after errors. (Will still emit a 'cacheTooSmall' event) (Defaults to: `true`)

 - `maxConnections` {Number} The maximum number of connections to create for sending messages. (Defaults to: `1`)

 - `connectTimeout` {Number} The duration of time the module should wait, in milliseconds, when trying to establish a connection to Apple before failing. 0 = Disabled. {Defaults to: `10000`}

 - `connectionTimeout` {Number} The duration the socket should stay alive with no activity in milliseconds. 0 = Disabled. (Defaults to: `3600000` - 1h)

  - `connectionRetryLimit` {Number} The maximum number of connection failures that will be tolerated before `apn` will "terminate". [See below.](#connectionretrylimit) (Defaults to: 10)

 - `buffersNotifications` {Boolean} Whether to buffer notifications and resend them after failure. (Defaults to: `true`)

 - `fastMode` {Boolean} Whether to aggresively empty the notification buffer while connected - if set to true node-apn may enter a tight loop under heavy load while delivering notifications. (Defaults to: `false`)

##### Connection retry limit
TLS errors such as expired or invalid certificates will cause an error to be emitted, but in this case it is futile for `apn` to continue attempting to connect. There may also be other cases where connectivity issues mean that a process attempting to send notifications may simply become blocked with an ever-increasing queue of notifications. To attempt to combat this a (configurable) retry limit of 10 has been introduced. If ten consecutive connection failures occur then `apn` will emit an `error` event for the connection, then a `transmissionError` event will be emitted for *each* notification in the queue, with the error code `connectionRetryLimitExceeded` (514).

At this point the connection instance will enter a "terminated" state and further attempts to send a notification will immediately emit a `transmissionError` with the code `connectionTerminated` (515). In these cases it may be appropriate for your application to store the notification, to be resent when the connectivity issue is resolved.

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

### Event: 'completed'

`function () {}`

Emitted when all pending notifications have been transmitted to Apple and the pending queue is empty. This may be called more than once if a notification error occurs and notifications must be re-sent.

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

For further information please read [Handling Errors](Handling%20Errors.markdown).

[googlegroup]:https://groups.google.com/group/node-apn "node-apn Google Group"
[errors]:https://developer.apple.com/library/ios/#documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/CommunicatingWIthAPS.html#//apple_ref/doc/uid/TP40008194-CH101-SW4 "The Binary Interface and Notification Formats"

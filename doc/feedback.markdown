## apn.Feedback([options])

Creates a new connection to the Apple Push Notification Feedback Service and if `interval` isn't disabled automatically begins polling the service. Many of the options are the same as `apn.Connection()`

Attach an event to the `feedback` event to receive output.

 - `cert` {Buffer|String} TThe filename of the connection certificate to load from disk, or a Buffer/String containing the certificate data. (Defaults to: `cert.pem`)

 - `key` {Buffer|String} The filename of the connection key to load from disk, or a Buffer/String containing the key data. (Defaults to: `key.pem`)

 - `ca` An array of trusted certificates. Each element should contain either a filename to load, or a Buffer/String (in PEM format) to be used directly. If this is omitted several well known "root" CAs will be used. - You may need to use this as some environments don't include the CA used by Apple (entrust_2048).

 - `pfx` {Buffer|String} File path for private key, certificate and CA certs in PFX or PKCS12 format, or a Buffer containing the PFX data. If supplied will be used instead of certificate and key above.

 - `passphrase` {String} The passphrase for the connection key, if required

 - `production` {Boolean} Specifies which environment to connect to: Production (if true) or Sandbox - The hostname will be set automatically. (Defaults to NODE_ENV == "production", i.e. false unless the NODE_ENV environment variable is set accordingly)

 - `port` {Number} Feedback server port (Defaults to: `2196`)

 - `rejectUnauthorized` {Boolean} Reject Unauthorized property to be passed through to tls.connect() (Defaults to `true`)

 - `batchFeedback` {Boolean} Sets the behaviour for triggering the `feedback` event. When `true` the event will be triggered once per connection with an array of timestamp and device token tuples. Otherwise a `feedback` event will be emitted once per token received. (Defaults to: true)

 - `batchSize` {Number} The maximum number of tokens to pass when emitting the event - a value of 0 will cause all tokens to be passed after connection is reset. After this number of tokens are received the `feedback` event will be emitted. (Only applies when `batchFeedback` is enabled)

 - `interval` {Number} How often to automatically poll the feedback service. Set to `0` to disable. (Defaults to: `3600`)

**Important:** In a development environment you must set `production` to `false`.

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

[feedback]:https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/CommunicatingWIthAPS.html#//apple_ref/doc/uid/TP40008194-CH101-SW3 "The Feedback Service"
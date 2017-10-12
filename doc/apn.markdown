# APN

node-apn provides a non-blocking, fully managed interface to push notifications to iOS devices using the Apple Push Notification System.

To begin using the APN Module simply `let apn = require('apn')`.

If you are not familiar with how the Apple Push Notification System (APNS) works, it is recommended that you read the [Local and Push Notification Programming Guide][programming-guide], in particular the section on [The Path of a Remote Notification][push-path].

## The Basics

### Provider

Sending push notifications starts with creating a connection to APNS using the `apn.Provider` class. This must be configured with your credentials issued by Apple - using [Provider Authentication Tokens][provider-auth-tokens] is preferred. The `apn.Provider` will manage underlying sockets automatically. You will never need more than one `apn.Provider` for each application, per-process. They should always be reused rather than recreated to achieve the best possible performance.

```javascript
let provider = new apn.Provider({
  token: {
    key: "path/to/key.pem",
    keyId: "key-id",
    teamId: "developer-team-id"
  },
  production: false
});
```

See the [Provider documentation](provider.markdown) for more information.

### Device Tokens

To push a notification you will need a set of device tokens to send a notification to. These are in the form of a hex-encoded string (see example below). Information about getting device tokens can be found in [Registering for Remote Notifications][registration].

```javascript
let deviceTokens = ["834c8b48e6254e47435d74720b1d4a13e3e57d0bf318333c284c1db8ce8ddc58"];
```

### Notification

You will also need something to send to the devices. A push notification takes the form of a JSON payload sent to Apple which is then relayed to the devices. `node-apn` provides the `apn.Notification` class, a programmatic interface to generate notification payloads.

```javascript
let notification = new apn.Notification();
notification.alert = "Hello, world!";
notification.badge = 1;
notification.topic = "io.github.node-apn.test-app";
```

See the [Notification documentation](notification.markdown) for more information.

### Sending the notification

After you have created a `Provider` and a `Notification` you can send it to Apple. The module will take care of creating a secure connection, encoding the payload, transmitting it, handling errors and processing the response.

The `send` method returns a [`Promise`][promise] which will be fulfilled when all notifications have been successfully sent, or failed due to an error. The resolved value contains information about successful transmissions as well as details of failures.

```javascript
provider.send(notification, deviceTokens).then( (response) => {
		// response.sent: Array of device tokens to which the notification was sent succesfully
		// response.failed: Array of objects containing the device token (`device`) and either an `error`, or a `status` and `response` from the API
});
```

See the [Provider documentation](provider.markdown) for more information.

[programming-guide]:https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/index.html
[push-path]:https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/APNSOverview.html#//apple_ref/doc/uid/TP40008194-CH8-SW6
[provider-auth-tokens]:https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CommunicatingwithAPNs.html#//apple_ref/doc/uid/TP40008194-CH11-SW3
[registration]:https://developer.apple.com/library/content/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/HandlingRemoteNotifications.html#//apple_ref/doc/uid/TP40008194-CH6-SW3

[promise]:https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Promise

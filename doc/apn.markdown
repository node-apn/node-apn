# APN

node-apn provides a non-blocking, fully managed interface to push notifications to iOS devices using the Apple Push Notification System.

To use the APN Module one must `require('apn')`.

If you are not familiar with how the Apple Push Notificaion System (APNS) works, it is recommended that you read the [Local and Push Notification Programming Guide][pg] in particular the section on [A Push Notification and Its Path][pnpath].


### Sending a Push Notification

Sending push notifications is as simple as creating a new connection to APNS using the `Connection` class which should be configured, at minimum, with your applications' certificate and private key. The `Connection` class manages underlying sockets automatically.

Pushing a notification to a device is as simple as creating an instance of `Notification` and configuring its payload. When the payload is prepared and the [Device token](#apn.devicedevicetoken) is ready, call `Connection#pushNotification` with the notification object and the device token you wish to send it to. It is also possible to send the same notification object to multiple devices very efficiently please consult the documentation for `Connection#pushNotification` for more details.

[Connection documentation](connection.markdown)
[Notification documentation](notification.markdown)

The status of the `Connection` object, including underlying connections, can be observed by the events emitted. It is particularly important that you read [Handling Errors](Handling%20Errors.markdown)

### Monitoring the Feedback Service.

Apple provides the "Feedback Service" to inform you when devices you have attempted to send notifications to are no longer reachable - usually because the app has been deleted from the users device. The `Feedback` class will handle connecting to the Feedback service periodically and providing the results to your application for processing.

[Feedback documentation](feedback.markdown)

## apn.Device(deviceToken)

Returns a new `Device` object. `deviceToken` can be a `Buffer` or a `String` containing a "hex" representation of the token. Throws an error if the deviceToken supplied is invalid.

[pg]:https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Introduction.html#//apple_ref/doc/uid/TP40008194-CH1-SW1 "Local and Push Notification Programming Guide"
[pnpath]:https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW10 "A Push Notification and Its Path"

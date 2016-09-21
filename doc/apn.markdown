# APN

node-apn provides a non-blocking, fully managed interface to push notifications to iOS devices using the Apple Push Notification System.

To use the APN Module one must `require('apn')`.

If you are not familiar with how the Apple Push Notificaion System (APNS) works, it is recommended that you read the [Local and Push Notification Programming Guide][pg] in particular the section on [A Push Notification and Its Path][pnpath].


### Sending a Push Notification

Sending push notifications is as simple as creating a new connection to APNS using the `Connection` class which should be configured, at minimum, with your applications' certificate and private key. The `Connection` class manages underlying sockets automatically.

Pushing a notification to a device is as simple as creating an instance of `Notification` and configuring its payload. When the payload is prepared and the [Device token](#apn.devicedevicetoken) is ready, call `Connection#pushNotification` with the notification object and the device token you wish to send it to. It is also possible to send the same notification object to multiple devices very efficiently please consult the documentation for `Connection#pushNotification` for more details.

[Connection documentation](connection.markdown)
[Notification documentation](notification.markdown)

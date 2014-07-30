## apn.Notification([payload])

Returns a new `Notification` object. You can optionally pass in an object representing the payload, or configure properties on the returned object. See below.


## Class: apn.Notification

As of version 1.2.0 it is possible to use a set of methods provided by Notification object (`setAlertText`, `setActionLocKey`, `setLocKey`, `setLocArgs`, `setLaunchImage`) to aid the creation of the alert parameters. For applications which provide Newsstand capability there is a new boolean parameter `note.newsstandAvailable` to specify `content-available` in the payload.

For iOS 7 applications which support Silent Remote Notifications you can use the `note.contentAvailable` property. This is identical in functionality to  `note.newsstandAvailable` without the confusion of the "Newstand" terminology.

A `Notification` enapsulates the data to be compiled down to JSON and pushed to a device. See the [payload documentation][pl] for more details. At present the total length of the payload accepted by Apple is 256 bytes. 

*Note*: The maximum payload size will be increased to 2048 bytes when iOS 8 is released, these larger payloads are available for testing in the sandbox environment. `apn` is will automatically configure for larger payloads when connecting to the sandbox.

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

### notification.setAlertTitle(alertTitle)

Set the `title` property of the `aps.alert` object - used with Safari Push Notifications

### notification.setAlertAction(alertAction)

Set the `action` property of the `aps.alert` object - used with Safari Push Notifications

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

[pl]:https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/ApplePushService.html#//apple_ref/doc/uid/TP40008194-CH100-SW1 "Local and Push Notification Programming Guide: Apple Push Notification Service"
[notificationFormat]:https://developer.apple.com/library/ios/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/CommunicatingWIthAPS.html#//apple_ref/doc/uid/TP40008194-CH101-SW9 "The Binary Interface and Notification Format"
[webpayloaddocs]:https://developer.apple.com/library/prerelease/mac/documentation/NetworkingInternet/Conceptual/NotificationProgrammingGuideForWebsites/PushNotifications/PushNotifications.html#//apple_ref/doc/uid/TP40013225-CH3-SW12 "Configuring Safari Push Notifications"

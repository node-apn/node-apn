# Migration from v1.2.x to v1.3.x


##tl;dr

When sending messages replace `sendNotification(notification)` with `pushNotification(notification, token)` as below.

```diff
    if(iosClients[username] !== undefined) {
        device = new apn.Device(iosClients[username].token);
        count = ++(iosClients[username].count);
        note = new apn.Notification();

        note.badge = count;
        note.alert = message;
        note.sound = "alert.wav";
-       note.device = device;

        if(!process.env.DONTSEND) {
            if(apnProductionConnection != null) {
-               apnProductionConnection.sendNotification(note);
+               apnProductionConnection.pushNotification(note, device);
            }
        }
    }
```

## Introduction

As of v1.3.0 the `Notification.device` property has been deprecated to enable a single `Notification` to be sent to multiple devices without duplication or cluttering the API. This should offer significant memory advantages for high volume environments sending "broadcast" notifications in addition to code simplification. The device token(s) are passed into the new `#pushNotification` method instead of associating a notification with a single device. The previous functionality remains for now but will be removed in future versions, so prompt migration is advised to benefit from performance improvements.

##Connection.sendNotification()

This method has been deprecated in favour of `connection.pushNotification` which accepts two parameters instead one. 

* `notification` an instance of `Notification`, as previously, but without the `device` property set.
* `recipients` which can either be a single recipient or an array of recipients. A "recipient" in this context can be one of either a `Device` object, a Buffer or a Hex String, representing the device token to which the notification should be delivered. The notification object will be sent to each of the tokens passed into the method.

##Error Handling

In v1.3.0 the error handling situation has changed slightly. A notification can be sent to multiple devices, so an extra parameter referencing the `Device` object the notification should have been delivered to is passed. This applies to `Notification` relevant events, and `errorCallback()`. 

A single call to `#pushNotification` for many devices may raise multiple errors caused by each device. Any parameters you wish to keep track of, such as user ID's should be stored on a property on the `Device` object, where appropriate, as the same object will be returned to your code for error handling.

###errorCallback()

Two types of `errorCallback()` functionality are provided. A callback passed into the `Connection` options and a property on the `Notification` object.

Functionality provided by the `errorCallback` option passed into `new Connection()` will remain but it is worth noting that each case which would call this now emits a corresponding event. This permits you to attach listeners to specific events such as `transmissionError` or `socketError` instead of having a catch-all method and should simplify error handling.

The `Notification.errorCallback` functionality remains and functions as previously. The only difference being that the function should accept a second parameter which will contain the recipient `Device` object associated with the error.

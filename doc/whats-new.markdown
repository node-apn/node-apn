# What's new in v2.0

`node-apn` has been completely re-written for v2. As such, a lot has changed
and you are encouraged to read the full documentation to understand the
implications. If you have used v1.7 or earlier then hopefully you will find
the overview below helpful to understand the changes you will need to make to
your application to make the most of Apple's new protocol.

It's worth it!

## Overview

* `apn.Connection` has been renamed to `apn.Provider`
* `apn.Feedback` has been removed
* `apn.Device` has been removed - all tokens are now hex-encoded strings
* `apn.token` is provided to validate tokens and convert from `Buffer` if
  necessary
* Notifications are now required to have an associated `topic`
* `pushNotification(notification, tokens)` is now simply, `send(notification, recipients)`
* `send` returns a promise which will be fulfilled when all notifications have
  been sent

## Example

Below is an example use of v1.7 and how it would be converted to use v2.0

**v1.7:**

```javascript
function setup() {
  var connection = new apn.Connection(configuration);
  connection.on("transmissionError", notificationFailed);
}

func sendNotification(user) {
  var note = new apn.Notification();
  note.alert = "Hello " + user.name;

  connection.pushNotification(note, user.token);
}
```

**v2.0:**

```javascript
function setup() {
  let connection = new apn.Provider(configuration);
}

function sendNotification(user) {
  let note = new apn.Notification();
  note.alert = "Hello " + user.name;
  note.topic = "io.github.node-apn.test"

  connection.send(note, user.token).then( (response) => {
    response.sent.forEach( (token) => {
      notificationSent(user, token);
    });
    response.failed.forEach( (failure) => {
      if (failure.error) {
        // A transport-level error occurred (e.g. network problem)
        notificationError(user, failure.device, failure.error);
      } else {
        // `failure.status` is the HTTP status code
        // `failure.response` is the JSON payload
        notificationFailed(user, failure.device, failure.status, failure.response);
      }
    });
  });
}
```

# Testing your application with node-apn

If you need to test your applications' use of `node-apn` you may find the `apn/mock` package useful.

It is experimental and suggestions for improvements are welcome.

The `mock` package provides the same interface as the `apn` package

 - `apn.Provider`
 - `apn.Notification`
 - `apn.token`

When running your applications tests use the `require("apn/mock")` instead of `require("apn")`.

Even if you don't intend to test your applications' use of `apn`, the mocks will allow you to invoke the library without triggering network traffic.


## Mocking `apn.Provider.send()`

Internally, `apn.Provider` is backend by a private `apn.Client` which implements a single method interface: `write`.

`apn.Provider.send` will call `write` for each of the device tokens passed in, along with the notification:

```javascript
apn.Client.write(notification, device)
```

`write` should return a `Promise` which resolves to an object. The properties of the object determine the outcome for that device/notification pair and should be set accordingly.

#### `sent`:
```javascript
{ 
  device: device
}
```

#### `rejected`:
```javascript
{
  device: device, 
  status: "410", // For implementation reasons, the status code must be a string, not a number
  response: {
    reason: "Unregistered"
  }
}
```

#### `error`:
```javascript
{
  device: device,
  error: new Error("some fake error")
}
```

### How to mock `apn.Client`

`apn/mock` provides the _real_ implementation of `apn.Provider` but instead backs it with a mock `apn.Client`. By default this mock will resolve all notifications in the `sent` state. `apn/mock` surfaces the mock `apn.Client`. By replacing `apn.Client.prototype.write` or even the whole initializer with stubs or spys you can inspect your applications' use of the library.
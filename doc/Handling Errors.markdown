
## Handling Errors

When an error occurs while pushing a notification and the enhanced interface is enabled, Apple sends a message back to node-apn containing the "identifier" of the notification (a value managed internally within node-apn) which caused the error and an associated error code (See: [The Binary Interface and Notification Formats][errors]). Apple does not return the entire message so node-apn caches a number of notifications after they are sent, so in the event an error occurs node-apn can find the one with the correct identifier from the cache and trigger the `transmissionError` event with the appropriate `Notification` object and `Device` it should have been delivered to.

Apple guarantees that if one notification causes an error none of the following notifications will be processed, so if node-apn can find the correct notification which caused the error in the cache, then it can automatically re-send all the ones afterward.

It's not a good idea to cache notifications indefinitely because after a certain length of time has passed we can be confident that Apple have received the notification without problem so it is implemented as a fixed size FIFO queue internally. Depending on how high-volume your environment is it's possible that many notifications will be successfully sent to Apple before the error response is sent.

The cache size defaults to 100 which will have neglible impact on memory usage and will suit low-volume environments. Testing has shown that an error response can take as long as 200ms, while the module has proven the ability to send over 5000 notifications per second, so it may necessary to increase the size of the cache to ensure node-apn can find the problematic one and resend all the following ones. The `autoAdjustCache` option is designed to address this problem but it risks losing notifications until the size has automatically increased accordingly, for best results manual adjustment according to your requirements is recommended.

If the cache is too small then node-apn wont be able to return the bad notification to through the `transmissionError` event and will pass `null` instead. The module _will_ resend all notifications in the cache but some may have been lost between the bad notification and the first one in the cache.

If you wish to disable the automatic resending functionality please consult the `buffersNotifications` configuration option on [Connection](connection.markdown).

[errors]:https://developer.apple.com/library/ios/#documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/Chapters/CommunicatingWIthAPS.html#//apple_ref/doc/uid/TP40008194-CH101-SW4 "The Binary Interface and Notification Formats"
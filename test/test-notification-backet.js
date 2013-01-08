var buster = require('buster');
var NotificationBucket = require('../lib/notification-bucket');
var Notification = require('../lib/notification');

buster.testCase('NotificationBucket', {
    'initial values': function () {
        var bucket = new NotificationBucket({});

        assert(bucket.getBuffer() instanceof Buffer);
        assert(bucket.options.enhanced);
        assert.equals(bucket.notificationCount, 0);
        assert(0 < bucket.options.maxLength);
        assert.equals(bucket.availableLength(), bucket.options.maxLength);
        assert(0 < bucket.sentinelNotificationLength());
    },

    'sentinel': function() {
        var bucket = new NotificationBucket({});

        bucket.appendSentinelNotification(1);
        assert.equals(bucket.availableLength(), bucket.options.maxLength - bucket.sentinelNotificationLength());

        // bucket.notificationCount shouldn't count the sentinel
        assert.equals(bucket.notificationCount, 0);
    },

    'notification': function() {
        var bucket = new NotificationBucket({});

        // append an almost empty notification
        var emptyNotification = new Notification();
        emptyNotification.alert = '';
        var compiled0 = emptyNotification.getCompiledNotification();
        var token0 = new Buffer(0);

        var expectedLength = 1 + 4 + 4 + 2 + token0.length + 2 + compiled0.payload.length;
        assert.equals(bucket.calculateNotificationLength(compiled0, token0), expectedLength);
                      
        bucket.appendToBuffer(compiled0, token0, 1);
        assert.equals(bucket.availableLength(), bucket.options.maxLength - expectedLength);
        assert.equals(bucket.notificationCount, 1);

        // append another
        var notification1 = new Notification();
        notification1.alert = 'abc';
        var compiled1 = notification1.getCompiledNotification();
        assert.equals(compiled1.payload.length, compiled0.payload.length + 3);
        var token1 = new Buffer(8);

        var availableLength = bucket.availableLength();
        var expectedLength1 = 1 + 4 + 4 + 2 + token1.length + 2 + compiled1.payload.length;
        assert.equals(bucket.calculateNotificationLength(compiled1, token1), expectedLength1);
        bucket.appendToBuffer(compiled1, token1, 2);
        assert.equals(bucket.availableLength(), availableLength - expectedLength1);
        assert.equals(bucket.notificationCount, 2);

        // make the buffer full (append sentinel to its tail)
        var id = 3;
        while (expectedLength1 * 2 < bucket.availableLength()) {
            bucket.appendToBuffer(compiled1, token1, id++);
        }
        var lastTokenLength = token1.length + (bucket.availableLength() - expectedLength1) -
            bucket.sentinelNotificationLength();
        var token2 = new Buffer(lastTokenLength);
        bucket.appendToBuffer(compiled1, token2, id);
        var lastId = id;

        bucket.appendSentinelNotification(9999);
        assert.equals(bucket.availableLength(), 0);

        // purge
        var currentCount = bucket.notificationCount;

        // purge the head
        assert.equals(bucket.purgeNotificationUntil(1), 1);
        --currentCount;
        assert.equals(bucket.notificationCount, currentCount);

        // that should have removed the sentinel implicitly
        assert.equals(bucket.availableLength(),
                      expectedLength + bucket.sentinelNotificationLength());

        // purge for unknown id should do nothing
        assert.same(bucket.purgeNotificationUntil(998), false);

        // purge next
        assert.equals(bucket.purgeNotificationUntil(2), 1);
        --currentCount;

        // purge for tail
        assert.equals(bucket.purgeNotificationUntil(lastId), currentCount);
        assert.equals(bucket.notificationCount, 0);
        assert.equals(bucket.availableLength(), bucket.options.maxLength);

        // clear notification
        bucket.appendToBuffer(compiled1, token2, id);
        bucket.clear();
        assert.equals(bucket.notificationCount, 0);
        assert.equals(bucket.availableLength(), bucket.options.maxLength);
        bucket.clear();         // clear for empty buffer should make no effect
    }
});

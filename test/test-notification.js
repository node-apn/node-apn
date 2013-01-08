var buster = require('buster');
var Notification = require('../lib/notification');

buster.testCase('Notification', {
    'initial': function() {
        var notification = new Notification();
        assert.equals(notification.encoding, 'utf8');
        assert.equals(notification.expiry, 0);
        assert.equals(JSON.stringify(notification), '{"aps":{}}');
        assert.equals(notification.toBinaryTemplate(),
                      { expiry: 0, payload: JSON.stringify(notification) });
    },

    'expiry': function() {
        var notification = new Notification();
        var now = (new Date()).getTime() / 1000;
        notification.expiry = now;
        assert.equals(JSON.stringify(notification), '{"aps":{}}');
        assert.equals(notification.toBinaryTemplate(),
                      { expiry: now, payload: JSON.stringify(notification) });
    },

    'alert': function() {
        var notification = new Notification();
        notification.setAlertText('hello');
        assert.equals(JSON.stringify(notification), '{"aps":{"alert":"hello"}}');
        assert.equals(notification.toBinaryTemplate(),
                      { expiry: 0, payload: JSON.stringify(notification) });

        notification.setLocKey('localizedHello');
        notification.setActionLocKey('localizedHelloAction');
        notification.setLocArgs(['argX', 'argY']);
        notification.setLaunchImage('http://example.com/image.jpg');

        assert.equals(JSON.stringify(notification),
                      '{"aps":{"alert":{"body":"hello","loc-key":"localizedHello","action-loc-key":"localizedHelloAction","loc-args":["argX","argY"],"launch-image":"http://example.com/image.jpg"}}}');
        assert.equals(notification.toBinaryTemplate(),
                      { expiry: 0, payload: JSON.stringify(notification) });
    }
});

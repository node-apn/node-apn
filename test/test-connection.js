var buster = require('buster');
var Notification = require('../lib/notification');
var Connection = require('../lib/connection');

buster.testCase('Connection', {
    setUp: function() {
        this.connection = new Connection({notificationWaitingTime: 300});
        this.stub(this.connection, 'connect', function() {
            this.connection.deferredConnection.resolve();
            this.connection.deferredConnectionWritable.resolve();
            this.connection.connectionState = Connection.STATE_CONNECTED;
            return this.connection.deferredConnection.promise;
        }.bind(this));

        this.stub(this.connection, 'isSocketWritable', function() {
            return true;
        });
    },

    'initial': function() {
        var connection = new Connection();
        assert.equals(connection.running, false);
        assert.equals(connection.connectionState, Connection.STATE_DISCONNECTED);
    },

    'addNotification': function() {
        var connection = this.connection;

        var notification = new Notification();
        notification.alert = (new Array(200)).join('a')
        var token = (new Array(65)).join('9');

        // disable Connection#run
        this.stub(connection, 'run');

        var clock = this.useFakeTimers();

        // add one
        connection.addNotification(notification, token);

        clock.tick(299);
        // should not be flushed
        assert(!connection.deferredBucketSendable.promise.isResolved());

        clock.tick(1);
        // should be flushed after elapsed 300ms 
        assert(connection.deferredBucketSendable.promise.isResolved());

        clock.restore();
    },

    'handleTransmissionError': function() {
        var connection = this.connection;

        // disable Connection#run
        this.stub(connection, 'run');

        // add one
        var notification1 = new Notification();
        notification1.alert = (new Array(200)).join('a')
        var token1 = (new Array(65)).join('9');
        connection.addNotification(notification1, token1);

        // add more
        var notification2 = new Notification();
        notification2.alert = (new Array(200)).join('b')
        var token2 = (new Array(65)).join('8');
        connection.addNotification(notification2, token2);

        // add more
        var notification3 = new Notification();
        notification2.alert = (new Array(200)).join('c')
        var token3 = (new Array(65)).join('7');
        connection.addNotification(notification3, token3);

        // error on 2
        var sentCallback = this.spy();
        var errorCallback = this.spy();
        connection.on('sent', sentCallback);
        connection.on('transmissionError', errorCallback);
        connection.handleTransmissionError(new Buffer([0x08, 0x02, 0x00, 0x00, 0x00, 0x01]));
        assert(sentCallback.calledWith(2));
        assert(errorCallback.calledWith(2, token2.toString('hex')));
        assert.equals(connection.countNotification(), 1);

        // error on unknown
        connection.handleTransmissionError(new Buffer([0x08, 0x07, 0x00, 0x00, 0x00, 0x08]));
        assert(sentCallback.secondCall.calledWith(1));
        assert(errorCallback.secondCall.calledWith(7, null));
        assert.equals(connection.countNotification(), 0);
    }
});

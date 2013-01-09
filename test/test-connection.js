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
    }
});

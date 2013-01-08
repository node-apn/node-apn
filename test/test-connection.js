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

    'broadcast calls flush() right after callback returns false': function(done) {
        var connection = this.connection;

        var notification = new Notification();

        // should be called three times.
        var calledTimes = 0;
        var callback = this.spy(function () {
            switch (++calledTimes) {
            case 1: return '0001';
            case 2: return '0002';
            case 3: return false;
            }
        });

        // disable Connection#run
        this.stub(connection, 'run');
        
        connection.broadcast(notification, callback);

        connection.deferredBucketSendable.promise.then(function() {
            assert(callback.calledThrice);
            done();
        });
    },

    'broadcast calls can be stopped by null, too': function(done) {
        var connection = this.connection;

        var notification = new Notification();

        // should be called three times.
        var calledTimes = 0;
        var callback = this.spy(function () {
            switch (++calledTimes) {
            case 1: return '0001';
            case 2: return '0002';
            case 3: return null;
            }
        });

        // disable Connection#run
        this.stub(connection, 'run');

        connection.broadcast(notification, callback);

        connection.deferredBucketSendable.promise.then(function() {
            assert(callback.calledThrice);
            done();
        });
    },

    'broadcast calls flush() when the bucket gets full': function(done) {
        var connection = this.connection;

        var notification = new Notification();
        notification.alert = (new Array(200)).join('a')

        var calledTimes = 0;
        var flushed = false;
        callback = this.spy(function () {
            return flushed ? false : (new Array(65)).join('9')
        });

        // disable Connection#run
        this.stub(connection, 'run');

        connection.broadcast(notification, callback);

        connection.deferredBucketSendable.promise.then(function() {
            assert(true);
            flushed = true;
            done();
        });

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

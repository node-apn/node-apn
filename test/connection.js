var rewire = require("rewire");
var Connection = rewire("../lib/connection");

var sinon = require("sinon");

describe("Connection", function() {
	describe('constructor', function () {
		var originalEnv;

		before(function() {
			originalEnv = process.env.NODE_ENV;
		});

		after(function() {
			process.env.NODE_ENV = originalEnv;
		})

		beforeEach(function() {
			process.env.NODE_ENV = "";
		})

		// Issue #50
		it("should use gateway.sandbox.push.apple.com as the default connection address", function () {
			expect(Connection().options.address).to.equal("gateway.sandbox.push.apple.com");
		});

		it("should use gateway.push.apple.com when NODE_ENV=production", function () {
			process.env.NODE_ENV = "production";
			expect(Connection().options.address).to.equal("gateway.push.apple.com");
		});

		it("should give precedence to production flag over NODE_ENV=production", function () {
			process.env.NODE_ENV = "production";
			expect(Connection({ production: false }).options.address).to.equal("gateway.sandbox.push.apple.com");
		});

		it("should use gateway.push.apple.com when production:true", function () {
			expect(Connection({production:true}).options.address).to.equal("gateway.push.apple.com");
		});

		it("should use a custom address when passed", function () {
			expect(Connection({address: "testaddress"}).options.address).to.equal("testaddress");
		});
	});

	describe('#initialize', function () {
		describe("with valid credentials", function() {
			var initialization;
			before(function() {
				initialization = Connection({ pfx: "test/credentials/support/certIssuerKeyPassphrase.p12", passphrase: "apntest" }).initialize();
			});

			it("should be fulfilled", function () {
				return expect(initialization).to.be.fulfilled;
			});
		});
	});

	describe("connect", function() {
		var socketStub, removeStub;
		before(function() {
			socketStub = sinon.stub();
			removeStub = Connection.__set__("createSocket", socketStub);
		});

		after(function() {
			removeStub();
		});

		afterEach(function() {
			socketStub.reset();
		});

		it("initializes the module", function(done) {
			socketStub.callsArg(2);
	 		socketStub.returns({ on: function() {}, once: function() {}, end: function() {} });

			var connection = Connection({ pfx: "a-non-existant-file-which-really-shouldnt-exist.pfx" });
			sinon.spy(connection, "initialize");
			connection.connect().finally(function() {
				expect(connection.initialize).to.have.been.calledOnce;
				done();
			});
		});

		describe("with valid credentials", function() {
			beforeEach(function() {
				socketStub.callsArg(2);
				socketStub.returns({ on: function() {}, once: function() {}, end: function() {} });
			});

			it("resolves", function() {
				var connection = Connection({ pfx: "test/credentials/support/certIssuerKeyPassphrase.p12", passphrase: "apntest" });
				return expect(connection.connect()).to.be.fulfilled;
			});

		});

		describe("intialization failure", function() {
			it("is rejected", function() {
				var connection = Connection({ pfx: "a-non-existant-file-which-really-shouldnt-exist.pfx" });
				return expect(connection.connect()).to.be.rejected;
			});
		});
	});
});
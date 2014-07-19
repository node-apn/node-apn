var apn = require("../");
var fs = require("fs");

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
			apn.Connection().options.address.should.equal("gateway.sandbox.push.apple.com");
		});

		it("should use gateway.push.apple.com when NODE_ENV=production", function () {
			process.env.NODE_ENV = "production";
			apn.Connection().options.address.should.equal("gateway.push.apple.com");
		});

		it("should give precedence to production flag over NODE_ENV=production", function () {
			process.env.NODE_ENV = "production";
			apn.Connection({ production: false }).options.address.should.equal("gateway.sandbox.push.apple.com");
		});

		it("should use gateway.push.apple.com when production:true", function () {
			apn.Connection({production:true}).options.address.should.equal("gateway.push.apple.com");
		});

		it("should use a custom address when passed", function () {
			apn.Connection({address: "testaddress"}).options.address.should.equal("testaddress");
		});
	});

	describe('#initialize', function () {
		var pfx, cert, key, ca;
		before(function () {
			pfx = fs.readFileSync("test/support/initializeTest.pfx");
			cert = fs.readFileSync("test/support/initializeTest.crt");
			key = fs.readFileSync("test/support/initializeTest.key");
		});

		it("should eventually load a pfx file from disk", function () {
			return apn.Connection({ pfx: "test/support/initializeTest.pfx" })
					  .initialize().get(0).post("toString")
					  .should.eventually.equal(pfx.toString());
		});

		it("should eventually provide pfx data from memory", function () {
			return apn.Connection({ pfx: pfx }).initialize().get(0).post("toString")
					  .should.eventually.equal(pfx.toString());
		});

		it("should eventually provide pfx data explicitly passed in pfxData parameter", function () {
			return apn.Connection({ pfxData: pfx }).initialize().get(0).post("toString")
					  .should.eventually.equal(pfx.toString());
		});

		it("should eventually load a certificate from disk", function () {
			return apn.Connection({ cert: "test/support/initializeTest.crt", key: null})
					  .initialize().get(1).post("toString")
					  .should.eventually.equal(cert.toString());
		});

		it("should eventually provide a certificate from a Buffer", function () {
			return apn.Connection({ cert: cert, key: null})
					  .initialize().get(1).post("toString")
					  .should.eventually.equal(cert.toString());
		});

		it("should eventually provide a certificate from a String", function () {
			return apn.Connection({ cert: cert.toString(), key: null})
					  .initialize().get(1)
					  .should.eventually.equal(cert.toString());
		});

		it("should eventually provide certificate data explicitly passed in the certData parameter", function () {
			return apn.Connection({ certData: cert, key: null})
					  .initialize().get(1).post("toString")
					  .should.eventually.equal(cert.toString());
		});

		it("should eventually load a key from disk", function () {
			return apn.Connection({ cert: null, key: "test/support/initializeTest.key"})
					  .initialize().get(2).post("toString")
					  .should.eventually.equal(key.toString());
		});

		it("should eventually provide a key from a Buffer", function () {
			return apn.Connection({ cert: null, key: key})
					  .initialize().get(2).post("toString")
					  .should.eventually.equal(key.toString());
		});

		it("should eventually provide a key from a String", function () {
			return apn.Connection({ cert: null, key: key.toString()})
					  .initialize().get(2)
					  .should.eventually.equal(key.toString());
		})

		it("should eventually provide key data explicitly passed in the keyData parameter", function () {
			return apn.Connection({ cert: null, keyData: key})
					  .initialize().get(2).post("toString")
					  .should.eventually.equal(key.toString());
		});

		it("should eventually load a single CA certificate from disk", function () {
			return apn.Connection({ cert: null, key: null, ca: "test/support/initializeTest.crt" })
					  .initialize().get(3).get(0).post("toString")
					  .should.eventually.equal(cert.toString());
		});

		it("should eventually provide a single CA certificate from a Buffer", function () {
			return apn.Connection({ cert: null, key: null, ca: cert })
					  .initialize().get(3).get(0).post("toString")
					  .should.eventually.equal(cert.toString());
		});

		it("should eventually provide a single CA certificate from a String", function () {
			return apn.Connection({ cert: null, key: null, ca: cert.toString() })
					  .initialize().get(3).get(0)
					  .should.eventually.equal(cert.toString());
		});

		it("should eventually load an array of CA certificates", function (done) {
			apn.Connection({ cert: null, key: null, ca: ["test/support/initializeTest.crt", cert, cert.toString()] })
			  .initialize().get(3).spread(function(cert1, cert2, cert3) {
			  	var certString = cert.toString();
			  	if (cert1.toString() == certString && 
			  		cert2.toString() == certString &&
			  		cert3.toString() == certString) {
			  		done();
			  	}
			  	else {
			  		done(new Error("provided certificates did not match"));
			  	}
			  }, done);
		});
	});
});
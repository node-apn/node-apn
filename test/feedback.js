var apn = require("../");
var fs = require("fs");

describe("Feedback", function() {
	describe('constructor', function () {
		var requestMethod;

		before(function() {
			requestMethod = apn.Feedback.prototype.request;
			apn.Feedback.prototype.request = function() { };
		});

		after(function() {
			apn.Feedback.prototype.request = requestMethod;
		})

		// Issue #50
		it("should use feedback.sandbox.push.apple.com as the default Feedback address", function () {
			var existingEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "";
			apn.Feedback().options.address.should.equal("feedback.sandbox.push.apple.com");
			process.env.NODE_ENV = existingEnv;
		});

		it("should use feedback.push.apple.com when NODE_ENV=production", function () {
			var existingEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";
			apn.Feedback().options.address.should.equal("feedback.push.apple.com");
			process.env.NODE_ENV = existingEnv;
		});

		it("should use feedback.push.apple.com when production:true", function () {
			apn.Feedback({production:true}).options.address.should.equal("feedback.push.apple.com");
		});

		it("should give precedence to production flag over NODE_ENV=production", function () {
			var existingEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";
			apn.Feedback({ production: false }).options.address.should.equal("feedback.sandbox.push.apple.com");
			process.env.NODE_ENV = existingEnv;
		});

		it("should use a custom address when passed", function () {
			apn.Feedback({address: "testaddress"}).options.address.should.equal("testaddress");
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
			return apn.Feedback({ pfx: "test/support/initializeTest.pfx" })
					  .initialize().get(0).post("toString")
					  .should.eventually.equal(pfx.toString());
		});

		it("should eventually provide pfx data from memory", function () {
			return apn.Feedback({ pfx: pfx }).initialize().get(0).post("toString")
					  .should.eventually.equal(pfx.toString());
		});

		it("should eventually provide pfx data explicitly passed in pfxData parameter", function () {
			return apn.Feedback({ pfxData: pfx }).initialize().get(0).post("toString")
					  .should.eventually.equal(pfx.toString());
		});

		it("should eventually load a certificate from disk", function () {
			return apn.Feedback({ cert: "test/support/initializeTest.crt", key: null})
					  .initialize().get(1).post("toString")
					  .should.eventually.equal(cert.toString());
		});

		it("should eventually provide a certificate from a Buffer", function () {
			return apn.Feedback({ cert: cert, key: null})
					  .initialize().get(1).post("toString")
					  .should.eventually.equal(cert.toString());
		});

		it("should eventually provide a certificate from a String", function () {
			return apn.Feedback({ cert: cert.toString(), key: null})
					  .initialize().get(1)
					  .should.eventually.equal(cert.toString());
		});

		it("should eventually provide certificate data explicitly passed in the certData parameter", function () {
			return apn.Feedback({ certData: cert, key: null})
					  .initialize().get(1).post("toString")
					  .should.eventually.equal(cert.toString());
		});

		it("should eventually load a key from disk", function () {
			return apn.Feedback({ cert: null, key: "test/support/initializeTest.key"})
					  .initialize().get(2).post("toString")
					  .should.eventually.equal(key.toString());
		});

		it("should eventually provide a key from a Buffer", function () {
			return apn.Feedback({ cert: null, key: key})
					  .initialize().get(2).post("toString")
					  .should.eventually.equal(key.toString());
		});

		it("should eventually provide a key from a String", function () {
			return apn.Feedback({ cert: null, key: key.toString()})
					  .initialize().get(2)
					  .should.eventually.equal(key.toString());
		})

		it("should eventually provide key data explicitly passed in the keyData parameter", function () {
			return apn.Feedback({ cert: null, keyData: key})
					  .initialize().get(2).post("toString")
					  .should.eventually.equal(key.toString());
		});

		it("should eventually load a single CA certificate from disk", function () {
			return apn.Feedback({ cert: null, key: null, ca: "test/support/initializeTest.crt" })
					  .initialize().get(3).get(0).post("toString")
					  .should.eventually.equal(cert.toString());
		});

		it("should eventually provide a single CA certificate from a Buffer", function () {
			return apn.Feedback({ cert: null, key: null, ca: cert })
					  .initialize().get(3).get(0).post("toString")
					  .should.eventually.equal(cert.toString());
		});

		it("should eventually provide a single CA certificate from a String", function () {
			return apn.Feedback({ cert: null, key: null, ca: cert.toString() })
					  .initialize().get(3).get(0)
					  .should.eventually.equal(cert.toString());
		});

		it("should eventually load an array of CA certificates", function (done) {
			apn.Feedback({ cert: null, key: null, ca: ["test/support/initializeTest.crt", cert, cert.toString()] })
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
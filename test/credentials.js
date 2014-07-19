var Credentials = require("../lib/credentials");
var fs = require("fs");

describe("Credentials", function() {
	var pfx, cert, key, ca;
	before(function () {
		pfx = fs.readFileSync("test/support/initializeTest.pfx");
		cert = fs.readFileSync("test/support/initializeTest.crt");
		key = fs.readFileSync("test/support/initializeTest.key");
	});

	it("should eventually load a pfx file from disk", function () {
		return Credentials({ pfx: "test/support/initializeTest.pfx" })
				  .get(0).post("toString")
				  .should.eventually.equal(pfx.toString());
	});

	it("should eventually provide pfx data from memory", function () {
		return Credentials({ pfx: pfx }).get(0).post("toString")
				  .should.eventually.equal(pfx.toString());
	});

	it("should eventually provide pfx data explicitly passed in pfxData parameter", function () {
		return Credentials({ pfxData: pfx }).get(0).post("toString")
				  .should.eventually.equal(pfx.toString());
	});

	it("should eventually load a certificate from disk", function () {
		return Credentials({ cert: "test/support/initializeTest.crt", key: null})
				  .get(1).post("toString")
				  .should.eventually.equal(cert.toString());
	});

	it("should eventually provide a certificate from a Buffer", function () {
		return Credentials({ cert: cert, key: null})
				  .get(1).post("toString")
				  .should.eventually.equal(cert.toString());
	});

	it("should eventually provide a certificate from a String", function () {
		return Credentials({ cert: cert.toString(), key: null})
				  .get(1)
				  .should.eventually.equal(cert.toString());
	});

	it("should eventually provide certificate data explicitly passed in the certData parameter", function () {
		return Credentials({ certData: cert, key: null})
				  .get(1).post("toString")
				  .should.eventually.equal(cert.toString());
	});

	it("should eventually load a key from disk", function () {
		return Credentials({ cert: null, key: "test/support/initializeTest.key"})
				  .get(2).post("toString")
				  .should.eventually.equal(key.toString());
	});

	it("should eventually provide a key from a Buffer", function () {
		return Credentials({ cert: null, key: key})
				  .get(2).post("toString")
				  .should.eventually.equal(key.toString());
	});

	it("should eventually provide a key from a String", function () {
		return Credentials({ cert: null, key: key.toString()})
				  .get(2)
				  .should.eventually.equal(key.toString());
	})

	it("should eventually provide key data explicitly passed in the keyData parameter", function () {
		return Credentials({ cert: null, keyData: key})
				  .get(2).post("toString")
				  .should.eventually.equal(key.toString());
	});

	it("should eventually load a single CA certificate from disk", function () {
		return Credentials({ cert: null, key: null, ca: "test/support/initializeTest.crt" })
				  .get(3).get(0).post("toString")
				  .should.eventually.equal(cert.toString());
	});

	it("should eventually provide a single CA certificate from a Buffer", function () {
		return Credentials({ cert: null, key: null, ca: cert })
				  .get(3).get(0).post("toString")
				  .should.eventually.equal(cert.toString());
	});

	it("should eventually provide a single CA certificate from a String", function () {
		return Credentials({ cert: null, key: null, ca: cert.toString() })
				  .get(3).get(0)
				  .should.eventually.equal(cert.toString());
	});

	it("should eventually load an array of CA certificates", function (done) {
		Credentials({ cert: null, key: null, ca: ["test/support/initializeTest.crt", cert, cert.toString()] })
		  .get(3).spread(function(cert1, cert2, cert3) {
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
var loadCredentials = require("../../lib/credentials/load");
var fs = require("fs");

describe("loadCredentials", function() {
	var pfx, cert, key;
	before(function () {
		pfx = fs.readFileSync("test/support/initializeTest.pfx");
		cert = fs.readFileSync("test/support/initializeTest.crt");
		key = fs.readFileSync("test/support/initializeTest.key");
	});

	it("should eventually load a pfx file from disk", function () {
		return expect(loadCredentials({ pfx: "test/support/initializeTest.pfx" })
				  .get("pfx").post("toString"))
				  .to.eventually.equal(pfx.toString());
	});

	it("should eventually provide pfx data from memory", function () {
		return expect(loadCredentials({ pfx: pfx }).get("pfx").post("toString"))
				  .to.eventually.equal(pfx.toString());
	});

	it("should eventually provide pfx data explicitly passed in pfxData parameter", function () {
		return expect(loadCredentials({ pfxData: pfx }).get("pfx").post("toString"))
				  .to.eventually.equal(pfx.toString());
	});

	it("should eventually load a certificate from disk", function () {
		return expect(loadCredentials({ cert: "test/support/initializeTest.crt", key: null})
				  .get("cert").post("toString"))
				  .to.eventually.equal(cert.toString());
	});

	it("should eventually provide a certificate from a Buffer", function () {
		return expect(loadCredentials({ cert: cert, key: null})
				  .get("cert").post("toString"))
				  .to.eventually.equal(cert.toString());
	});

	it("should eventually provide a certificate from a String", function () {
		return expect(loadCredentials({ cert: cert.toString(), key: null})
				  .get("cert"))
				  .to.eventually.equal(cert.toString());
	});

	it("should eventually provide certificate data explicitly passed in the certData parameter", function () {
		return expect(loadCredentials({ certData: cert, key: null})
				  .get("cert").post("toString"))
				  .to.eventually.equal(cert.toString());
	});

	it("should eventually load a key from disk", function () {
		return expect(loadCredentials({ cert: null, key: "test/support/initializeTest.key"})
				  .get("key").post("toString"))
				  .to.eventually.equal(key.toString());
	});

	it("should eventually provide a key from a Buffer", function () {
		return expect(loadCredentials({ cert: null, key: key})
				  .get("key").post("toString"))
				  .to.eventually.equal(key.toString());
	});

	it("should eventually provide a key from a String", function () {
		return expect(loadCredentials({ cert: null, key: key.toString()})
				  .get("key"))
				  .to.eventually.equal(key.toString());
	});

	it("should eventually provide key data explicitly passed in the keyData parameter", function () {
		return expect(loadCredentials({ cert: null, keyData: key})
				  .get("key").post("toString"))
				  .to.eventually.equal(key.toString());
	});

	it("should eventually load a single CA certificate from disk", function () {
		return expect(loadCredentials({ cert: null, key: null, ca: "test/support/initializeTest.crt" })
				  .get("ca").get(0).post("toString"))
				  .to.eventually.equal(cert.toString());
	});

	it("should eventually provide a single CA certificate from a Buffer", function () {
		return expect(loadCredentials({ cert: null, key: null, ca: cert })
				  .get("ca").get(0).post("toString"))
				  .to.eventually.equal(cert.toString());
	});

	it("should eventually provide a single CA certificate from a String", function () {
		return expect(loadCredentials({ cert: null, key: null, ca: cert.toString() })
				  .get("ca").get(0))
				  .to.eventually.equal(cert.toString());
	});

	it("should eventually load an array of CA certificates", function (done) {
		loadCredentials({ cert: null, key: null, ca: ["test/support/initializeTest.crt", cert, cert.toString()] })
		  .get("ca").spread(function(cert1, cert2, cert3) {
		  	var certString = cert.toString();
		  	if (cert1.toString() === certString && 
		  		cert2.toString() === certString &&
		  		cert3.toString() === certString) {
		  		done();
		  	}
		  	else {
		  		done(new Error("provided certificates did not match"));
		  	}
		  }, done);
	});

	it("returns undefined if no CA values are specified", function() {
		return expect(loadCredentials({ cert: null, key: null, ca: null}).get("ca")).to.eventually.be.undefined;
	});
	
	it("should inclue the passphrase in the resolved value", function() {
		return expect(loadCredentials({ passphrase: "apntest" }).get("passphrase"))
			.to.eventually.equal("apntest");
	});
});
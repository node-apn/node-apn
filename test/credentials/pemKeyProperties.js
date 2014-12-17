var pemKeyProperties = require("../../lib/credentials/pemKeyProperties");
var fs = require("fs");

describe("pemKeyProperties", function() {
	describe("returns metadata", function() {
		describe("plain key", function() {
			it("includes public key fingerprint", function() {
				var key = fs.readFileSync("test/credentials/support/key.pem");
				keyProperties = pemKeyProperties(key);
				expect(keyProperties.publicKeyFingerprint).to.equal("2d594c9861227dd22ba5ae37cc9354e9117a804d");
			});
		});
	});
});
"use strict";

var Notification = require("../../lib/notification");
var sinon = require("sinon");

describe("Notification", function() {

	var note;
	beforeEach(function() {
		note = new Notification();
	});

	describe("constructor", () => {
		it("accepts a pre-constructed payload", () => {
			let payload = { "some": "payload" };
			note = new Notification(payload);

			expect(note.payload).to.deep.equal({ "some": "payload" });
			expect(compiledOutput()).to.deep.equal({ "some": "payload" });
		});

		it("retains default aps properties", () => {
			let payload = { "some": "payload", "aps": {"alert": "Foo"}};

			note = new Notification(payload);

			expect(note.payload).to.deep.equal({ "some": "payload", "aps": {"alert": "Foo"}});
			expect(compiledOutput()).to.deep.equal({ "some": "payload", "aps": {"alert": "Foo"}});
		});
	});

	describe("aps payload", function() {
		describe("alert property", function() {
			it("defaults to undefined", function() {
				expect(note.alert).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("aps.alert");
			});

			it("can be set to a string", function() {
				note.alert = "hello";

				expect(note.alert).to.equal("hello");
				expect(compiledOutput()).to.have.deep.property("aps.alert", "hello");
			});

			it("can be set to an object", function() {
				note.alert = {"body": "hello"};
				expect(note.alert).to.eql({"body": "hello"});
				expect(compiledOutput()).to.have.deep.property("aps.alert")
					.that.deep.equals({"body": "hello"});
			});

			it("can be set to undefined", function() {
				note.alert = {"body": "hello"};
				note.alert = undefined;

				expect(note.alert).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("aps.alert");
			});

			it("cannot be set to a number", function() {
				note.alert = 5;

				expect(note.alert).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("aps.alert");
			});
		});

		describe("alertText property", function() {
			it("defaults to undefined", function() {
				expect(note.alertText).to.be.undefined;
			});

			it("can be set to a string", function() {
				note.alertText = "Hello, world";
				expect(note.alert)
			});
		});

		describe("badge property", function() {
			it("defaults to undefined", function() {
				expect(note.badge).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("aps.badge");
			});

			it("can be set to a number", function() {
				note.badge = 5;

				expect(typeof note.badge).to.equal("number");
				expect(compiledOutput()).to.have.deep.property("aps.badge", 5);
			});

			it("can be set to undefined", function() {
				note.badge = 5;
				note.badge = undefined;

				expect(note.badge).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("aps.badge");
			});

			it("cannot be set to a string", function() {
				note.badge = "hello";

				expect(note.badge).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("aps.badge");
			});
		});

		describe("sound property", function() {
			it("defaults to undefined", function() {
				expect(note.sound).to.be.undefined;

				expect(compiledOutput()).to.not.have.deep.property("aps.sound");
			});

			it("can be set to a string", function() {
				note.sound = "sound.caf";

				expect(typeof note.sound).to.equal("string");
				expect(compiledOutput()).to.have.deep.property("aps.sound", "sound.caf");
			});

			it("can be set to undefined", function() {
				note.sound = "sound.caf";
				note.sound = undefined;

				expect(note.sound).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("aps.sound");
			});

			it("cannot be set to a number", function() {
				note.sound = 5;

				expect(note.sound).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("aps.sound");
			});
		});

		describe("content-available property", function() {
			it("defaults to undefined", function() {
				expect(note.contentAvailable).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("aps.content\-available");
			});

			it("can be set to a boolean value", function() {
				note.contentAvailable = true;

				expect(typeof note.contentAvailable).to.equal("boolean");
				expect(compiledOutput()).to.have.deep.property("aps.content\-available", 1);
			});

			it("can be set to undefined", function() {
				note.contentAvailable = true;
				note.contentAvailable = undefined;

				expect(note.contentAvailable).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("aps.content\-available");
			});

			it("cannot be set to a string", function() {
				note.contentAvailable = "true";

				expect(note.contentAvailable).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("aps.content\-available");
			});
		});

		describe("mdm property", function() {
			it("defaults to undefined", function() {
				expect(note.mdm).to.be.undefined;
			});

			it("can be set to a string", function() {
				note.mdm = "mdm payload";

				expect(note.mdm).to.equal("mdm payload");
				expect(compiledOutput()).to.deep.equal({"mdm": "mdm payload"});
			});

			it("can be set to undefined", function() {
				note.mdm = "mdm payload";
				note.mdm = undefined;

				expect(note.mdm).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("mdm");
			});

			it("does not include the aps payload", function() {
				note.mdm = "mdm payload";
				note.badge = 5;

				expect(compiledOutput()).to.not.have.any.keys("aps");
			});
		});

		describe("urlArgs property", function() {
			it("defaults to undefined", function() {
				expect(note.urlArgs).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("aps.url\-args");
			});

			it("can be set to an array", function() {
				note.urlArgs = ["arg1", "arg2"];

				expect(note.urlArgs).to.eql(["arg1", "arg2"]);
				expect(compiledOutput()).to.have.deep.property("aps.url\-args")
					.that.deep.equals(["arg1", "arg2"]);
			});

			it("can be set to undefined", function() {
				note.urlArgs = ["arg1", "arg2"];
				note.urlArgs = undefined;

				expect(note.urlArgs).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("aps.url\-args");
			});

			it("cannot be set to an object", function() {
				note.urlArgs = {};
				expect(note.urlArgs).to.be.undefined;

				expect(compiledOutput()).to.not.have.deep.property("aps.url\-args");
			});

			it("cannot be set to a string", function() {
				note.urlArgs = "arg1";
				expect(note.urlArgs).to.be.undefined;

				expect(compiledOutput()).to.not.have.deep.property("aps.url\-args");
			});
		});

		describe("category property", function() {
			it("defaults to undefined", function() {
				expect(note.category).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("aps.category");
			});

			it("can be set to a string", function() {
				note.category = "the-category";
				expect(note.category).to.eql("the-category");
				expect(compiledOutput()).to.have.deep.property("aps.category", "the-category");
			});

			it("cannot be set to an object", function() {
				note.category = {};
				expect(note.category).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("aps.category");
			});

			it("can be set to undefined", function() {
				note.category = "the-category";
				note.category = undefined;
				expect(note.category).to.be.undefined;
				expect(compiledOutput()).to.not.have.deep.property("aps.category");
			});
		});

		context("when no aps properties are set", function() {
			it("is not present", function() {
				expect(compiledOutput().aps).to.be.undefined;
			});
		});
	});

	describe("payload", function() {
		describe("when no aps properties are set", function() {
			it("contains all original payload properties", function() {
				note.payload = {"foo": "bar", "baz": 1};
				expect(compiledOutput()).to.eql({"foo": "bar", "baz": 1});
			});
		});

		describe("when aps payload is present", function() {
			beforeEach(function() {
				note.payload = {"foo": "bar", "baz": 1, "aps": { "badge": 1, "alert": "Hi there!" }};
			});

			it("contains all original payload properties", function() {
				expect(compiledOutput()).to.have.property("foo", "bar");
				expect(compiledOutput()).to.have.property("baz", 1);
			});

			xit("contains the correct aps properties", function() {
				expect(compiledOutput()).to.have.deep.property("aps.badge", 1);
				expect(compiledOutput()).to.have.deep.property("aps.alert", "Hi there!");
			});
		});

		context("when passed in the notification constructor", function() {
			beforeEach(function() {
				note = new Notification({"foo": "bar", "baz": 1, "aps": { "badge": 1, "alert": "Hi there!" }});
			});

			it("contains all original payload properties", function() {
				expect(compiledOutput()).to.have.property("foo", "bar");
				expect(compiledOutput()).to.have.property("baz", 1);
			});

			it("contains the correct aps properties", function() {
				expect(compiledOutput()).to.have.deep.property("aps.badge", 1);
				expect(compiledOutput()).to.have.deep.property("aps.alert", "Hi there!");
			});
		});
	});

	describe("length", function() {
		it("returns the correct payload length", function() {
			note.alert = "length";
			expect(note.length()).to.equal(26);
		});
	});

	describe("headers", function() {
		it("contains no properties by default", function() {
			expect(note.headers()).to.deep.equal({});
		});

		context("priority is non-default", function() {
			it("contains the apns-priority header", function() {
				note.priority = 5;
				expect(note.headers()).to.have.property("apns-priority", 5);
			});
		});

		context("id is set", function() {
			it("contains the apns-id header", function() {
				note.id = "123e4567-e89b-12d3-a456-42665544000";

				expect(note.headers()).to.have.property("apns-id", "123e4567-e89b-12d3-a456-42665544000");
			});
		});

		context("expiry is non-zero", function() {
			it("contains the apns-expiration header", function() {
				note.expiry = 1000;

				expect(note.headers()).to.have.property("apns-expiration", 1000);
			});
		});

		context("topic is set", function() {
			it("contains the apns-topic header", function() {
				note.topic = "io.apn.node";

				expect(note.headers()).to.have.property("apns-topic", "io.apn.node");
			});
		});
	});

	describe("compile", function() {
		var stub;
		beforeEach(function() {
			stub = sinon.stub(note, "toJSON");
		});

		it("compiles the JSON payload", function() {
			stub.returns("payload");

			expect(note.compile()).to.equal("\"payload\"");
		});

		it("returns the JSON payload", function() {
			stub.returns({});

			expect(note.compile()).to.equal("{}");
		});

		it("memoizes the JSON payload", function() {
			stub.returns("payload1");
			note.compile();

			stub.returns("payload2");

			expect(note.compile()).to.equal("\"payload1\"");
		});

		it("re-compiles the JSON payload when `note.compiled` = false", function() {
			stub.returns("payload1");
			note.compile();

			stub.returns("payload2");
			note.compiled = false;

			expect(note.compile()).to.equal("\"payload2\"");
		});
	});

	function compiledOutput() {
		return JSON.parse(note.compile())
	}
});

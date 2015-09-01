var apn = require("../");
var sinon = require("sinon");

describe("Notification", function() {

	var note;
	beforeEach(function() {
		note = new apn.Notification();
	});

	describe("aps payload", function() {
		describe("alert property", function() {
			it("defaults to undefined", function() {
				expect(note.alert).to.be.undefined;
			});

			it("can be set to a string", function() {
				note.alert = "hello";
				expect(note.alert).to.equal("hello");
			});

			it("resets the `compiled` flag", function() {
				note.compiled = true;
				note.alert = "hello";
				expect(note.compiled).to.be.false;
			});

			it("can be set to an object", function() {
				note.alert = {"body": "hello"};
				expect(note.alert).to.eql({"body": "hello"});
			});

			it("can be set to undefined", function() {
				note.alert = {"body": "hello"};
				note.alert = undefined;
				expect(note.alert).to.be.undefined;
			});

			it("cannot be set to a number", function() {
				note.alert = 5;
				expect(note.alert).to.be.undefined;
			});

			describe("getAlertText", function() {
				describe("plain alert string", function() {
					it("gets the alert text", function() {
						note.alert = "hello";

						expect(note.getAlertText()).to.equal("hello");
					});
				});

				describe("alert object", function() {
					it("gets the alert text", function() {
						note.alert = { "body": "hello" };

						expect(note.getAlertText()).to.equal("hello");
					});
				});
			});
		});

		describe("badge property", function() {
			it("defaults to undefined", function() {
				expect(note.badge).to.be.undefined;
			});

			it("can be set to a number", function() {
				note.badge = 5;
				expect(typeof note.badge).to.equal("number");
			});

			it("resets the `compiled` flag", function() {
				note.compiled = true;
				note.badge = 5;
				expect(note.compiled).to.be.false;
			});

			it("can be set to undefined", function() {
				note.badge = 5;
				note.badge = undefined;
				expect(note.badge).to.be.undefined;
			});

			it("cannot be set to a string", function() {
				note.badge = "hello";
				expect(note.badge).to.be.undefined;
			});
		});

		describe("sound property", function() {
			it("defaults to undefined", function() {
				expect(note.sound).to.be.undefined;
			});

			it("can be set to a string", function() {
				note.sound = "sound.caf";
				expect(typeof note.sound).to.equal("string");
			});

			it("resets the `compiled` flag", function() {
				note.compiled = true;
				note.sound = "sound.caf";
				expect(note.compiled).to.be.false;
			});

			it("can be set to undefined", function() {
				note.sound = "sound.caf";
				note.sound = undefined;
				expect(note.sound).to.be.undefined;
			});

			it("cannot be set to a number", function() {
				note.sound = 5;
				expect(note.sound).to.be.undefined;
			});
		});

		describe("content-available property", function() {
			it("defaults to undefined", function() {
				expect(note.contentAvailable).to.be.undefined;
			});

			it("can be set to `1` with a boolean value", function() {
				note.contentAvailable = true;
				expect(note.contentAvailable).to.equal(1);
			});

			it("resets the `compiled` flag when enabled", function() {
				note.compiled = true;
				note.contentAvailable = true;
				expect(note.compiled).to.be.false;
			});

			it("resets the `compiled` flag when disabled", function() {
				note.compiled = true;
				note.contentAvailable = false;
				expect(note.compiled).to.be.false;
			});

			it("can be set to undefined", function() {
				note.contentAvailable = true;
				note.contentAvailable = undefined;
				expect(note.contentAvailable).to.be.undefined;
			});

			it("can be set to `1`", function() {
				note.contentAvailable = 1;
				expect(typeof note.contentAvailable).to.equal("number");
			});

			it("cannot be set to a string", function() {
				note.contentAvailable = "true";
				expect(note.contentAvailable).to.be.undefined;
			});

			it("can be disabled", function() {
				note.contentAvailable = false;
				expect(note.contentAvailable).to.be.undefined;
			});

			describe("newsstand-available property", function() {
				it("sets the content available flag", function() {
					note.newsstandAvailable = true;
					expect(note.contentAvailable).to.equal(1);
				});

				it("returns the content-available flag", function() {
					note.contentAvailable = false;
					expect(note.newsstandAvailable).to.be.undefined;
				});
			});
		});

		describe("mdm property", function() {
			it("defaults to undefined", function() {
				expect(note.mdm).to.be.undefined;
			});

			it("can be set to a string", function() {
				note.mdm = "mdm payload";
				expect(typeof note.mdm).to.equal("string");
			});

			it("resets the `compiled` flag", function() {
				note.compiled = true;
				note.mdm = "mdm payload";
				expect(note.compiled).to.be.false;
			});

			it("can be set to undefined", function() {
				note.mdm = "mdm payload";
				note.mdm = undefined;
				expect(note.mdm).to.be.undefined;
			});
		});

		describe("urlArgs property", function() {
			it("defaults to undefined", function() {
				expect(note.urlArgs).to.be.undefined;
			});

			it("can be set to an array", function() {
				note.urlArgs = ["arg1", "arg2"];
				expect(note.urlArgs).to.eql(["arg1", "arg2"]);
			});

			it("resets the `compiled` flag", function() {
				note.compiled = true;
				note.urlArgs = ["arg1"];
				expect(note.compiled).to.be.false;
			});

			it("can be set to undefined", function() {
				note.urlArgs = ["arg1", "arg2"];
				note.urlArgs = undefined;
				expect(note.urlArgs).to.be.undefined;
			});

			it("cannot be set to an object", function() {
				note.urlArgs = {};
				expect(note.urlArgs).to.be.undefined;
			});

			it("cannot be set to a string", function() {
				note.urlArgs = "arg1";
				expect(note.urlArgs).to.be.undefined;
			});
		});

		describe("category property", function() {
			it("defaults to undefined", function() {
				expect(note.category).to.be.undefined;
			});

			it("can be set to a string", function() {
				note.category = "the-category";
				expect(note.category).to.eql("the-category");
			});

			it("resets the `compiled` flag", function() {
				note.compiled = true;
				note.category = "the-category";
				expect(note.compiled).to.be.false;
			});

			it("cannot be set to an object", function() {
				note.category = {};
				expect(note.category).to.be.undefined;
			});

			it("can be set to undefined", function() {
				note.category = "the-category";
				note.category = undefined;
				expect(note.category).to.be.undefined;
			});
		});
	});

	describe("length", function() {
		it("returns the correct payload length", function() {
			note.alert = "length";
			expect(note.length()).to.equal(26);
		});

		describe("payload changes after first calculation", function() {
			beforeEach(function() {
				note.alert = "short";
				note.length();
			});

			it("returns the correct payload length", function() {
				note.alert = "longer";
				expect(note.length()).to.equal(26);
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

	describe("trim", function() {
		describe("when notification payload is below the maximum length", function() {
			it("returns zero",function() {
				note.alert = "test message";
				expect(note.trim()).to.equal(0);
			});

			it("does not change the alert text", function() {
				var shortAlert = "This does not need trimming";
				note.alert = shortAlert;
				note.trim();

				expect(note.alert).to.equal(shortAlert);
			});
		});

		describe("when notification payload is greater than the maximum", function() {
			var longText = 'ㅂㅈ ㅐ: LONDON (AP) — E\\\veryone says there areare lots of hidden costs to owning a home. If you own a palace, the costs are royal.\n\nThat became evident when the Buckingham Palace released its accounts Thursday, which showed the monarchy cost British taxpayers 35.7 million pounds ($60.8 million) last year — 56 pence (just under $1) for everyone in the country.\n\nThat is 7.2 percent, or 2.4 million pounds, more than the year before and the increase is mainly explained by the British royal family\'s repair bills.\n\nTheir properties are hardly typical. Buckingham Palace, for example, has 240 bedrooms and 78 bathrooms. That\'s a lot of plumbing to fix when things go wrong.\n\nSo it\'s no surprise that more than a third of the money British taxpayers paid for the monarchy, led by Queen Elizabeth II, was spent on repairs, improvements and maintenance of aging but still opulent palaces.\n\n"We continue to focus on value for money," said Keeper of the Privy Purse Alan Reid, asserting that careful spending habits had allowed for more money to be used for important maintenance work.\n\n\nFILE - In this Saturday, June 14, 2014 file photo, Britain\'s Queen Elizabeth II, foreground, sur …\nA big part of the fixer-upper budget in the 12 months that ended on March 31 went to creating a suitable home for the young family of Prince William, his wife Kate and their toddler Prince George.\n\nSome 3.4 million pounds of taxpayer funds were used to refurbish part of London\'s Kensington Palace for the couple. The extensive work included removing asbestos, installing new heating and redecorating.\n\nThe couple, who have considerable personal financial resources in part because of the estate left by Princess Diana, paid for the carpets, curtains and furniture out of personal funds, the palace said.\n\nIn addition, Prince Charles\' private secretary, William Nye, suggested that Charles and his wife Camilla — who are supported by profits from the extensive Duchy of Cornwall estate — may have helped William and Kate set up their new home.\n\nThe palace accounts also showed the high cost of entertaining on a royal scale: 2 million pounds were spent on "housekeeping and hospitality" in the 12 months that ended on March 31.\n---ending ---\n\n';
			describe("with default length", function() {
				it("trims notification text to reduce payload to maximum length", function () {
					note.alert = longText
					note.trim();
					expect(note.length()).to.equal(2048);
				});
				
				it("trims notification alert body to reduce payload to maximum length", function () {
					note.alert = {
						body: longText
					};
					note.trim();
					expect(note.length()).to.equal(2048);
				});
			});

			describe("with custom length", function() {
				it("trims to a shorter length than default", function() {
					note.alert = "12345";
					var trimLength = note.length() - 2;
					note.trim(trimLength);
					expect(note.length()).to.equal(trimLength);
				});

				it("trims to a longer length than default", function() {
					note.alert = longText + longText;
					var trimLength = 4096;
					note.trim(trimLength);
					expect(note.length()).to.equal(4096);
				});
			});

			describe("with truncateAtWordEnd flag", function() {
				it("removes partially trimmed words", function() {
					note.alert = "this is a test payload";
					note.truncateAtWordEnd = true;

					note.trim(note.length() - 3);
					expect(note.alert).to.equal("this is a test");
				});

				it("does not truncate when boundary is at end of word", function() {
					note.alert = "this is a test payload";
					note.truncateAtWordEnd = true;

					note.trim(note.length() - 8);
					expect(note.alert).to.equal("this is a test");
				});

				it("leaves alert intact when there are no other spaces in the string", function() {
					note.alert = "this_is_a_test_payload";
					note.truncateAtWordEnd = true;

					note.trim(note.length() - 8);
					expect(note.alert).to.equal("this_is_a_test");
				});
			});

			describe("alert contains escape sequences at trim point", function() {
				it("strips them", function () {
					note.alert = "\n\n\n";
					var trimLength = note.length() - 2;
					note.trim(trimLength);
					expect(note.alert).to.equal("\n\n");
				});
				
				it("leaves escaped escape character intact", function() {
					note.alert = "test\\ message";
					note.trim(26);
					expect(note.alert).to.equal("test\\");
				});

				it("strips orphaned escape character", function () {
					note.alert = "test\\ message";
					note.trim(25);
					expect(note.alert).to.equal("test");
				});

				it("leaves an even number of escape characters", function() {
					note.alert = "test\\\\\n";
					note.trim(29);
					expect(note.alert).to.equal("test\\\\");
				});
			});

			it("returns the number of bytes removed from the alert text", function() {
				note.alert = "Test\ud83d\udca3";
				expect(note.trim(25)).to.equal(4);
			});

			describe("with no alert text", function() {
				it("returns the number of bytes too long", function() {
					note.payload.largePayload = "this is a very long payload";
					expect(note.trim(40)).to.equal(-6);
				});
			});

			describe("when alert text is shorter than the length that needs to be removed", function() {
				it("returns the number of bytes too long", function() {
					note.payload.largePayload = "this is a very long payload";
					note.alert = "alert";
					expect(note.trim(40)).to.equal(-25);
				});
			});
		});

		describe("unicode text", function() {
			it("trims to maximum byte length", function () {
				note.alert = "ㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐ";
				note.trim(256);
				expect(note.length()).to.be.at.most(256);
			});

			describe("with UTF-8 encoding", function() {
				it("removes trailing `REPLACEMENT CHARACTER` 0xFFFD", function() {
					note.alert = Buffer([0xF0, 0x9F, 0x98, 0x83, 0xF0, 0x9F, 0x98, 0x9E]).toString("utf8");
					var trimLength = note.length() - 1;
					note.trim(trimLength);

					var length = note.alert.length;
					expect(note.alert.charCodeAt(length - 1)).to.not.equal(0xFFFD);
				});
			});

			describe("with UTF-16LE encoding", function() {
				beforeEach(function() {
					note.encoding = "utf16le";
				});

				it("trims to correct byte length", function() {
					note.alert = "test message";
					note.trim(48);

					expect(note.length()).to.equal(48);
				});
				
				it("correctly empties the string", function() {
					note.alert = Buffer([0x3D, 0xD8, 0x03, 0xDE, 0x3D, 0xD8, 0x1E, 0xDE]).toString(note.encoding);
					var trimLength = note.length() - 8;
					note.trim(trimLength);

					expect(note.alert.length).to.equal(0);
				});

				it("removes orphaned lead surrogates", function() {
					note.alert = Buffer([0x3D, 0xD8, 0x03, 0xDE, 0x3D, 0xD8, 0x1E, 0xDE]).toString(note.encoding);
					var trimLength = note.length() - 2;
					note.trim(trimLength);

					var length = note.alert.length;
					expect(note.alert.charCodeAt(length - 1)).to.not.be.within(0xD800, 0xD8FF);
				});
			});

			describe("escape sequences", function() {
				it("removes sequence without digits", function() {
					note.alert = "\u0006\u0007";
					var trimLength = note.length() - 4;
					note.trim(trimLength);

					expect(note.alert.length).to.equal(1);
				});

				it("removes sequence with fewer than 4 digits", function() {
					note.alert = "\u0006\u0007";
					var trimLength = note.length() - 3;
					note.trim(trimLength);

					expect(note.alert.length).to.equal(1);
				});

				it("does not remove a complete sequence", function() {
					note.alert = "\u0006\u0007 ";
					var trimLength = note.length() - 1;
					note.trim(trimLength);

					expect(note.alert.charCodeAt(1)).to.equal(7);
				});
			});
		});
	});

	describe("toJSON", function() {
		it("returns an Object", function() {
			expect(note.toJSON()).to.be.an("object");
		});

		describe("payload", function() {
			describe("when no aps properties are set", function() {
				it("contains all original payload properties", function() {
					note.payload = {"foo": "bar", "baz": 1};
					expect(note.toJSON()).to.eql(note.payload);
				});
			});

			describe("when aps payload is present", function() {
				it("contains all original payload properties", function() {
					note.payload = {"foo": "bar", "baz": 1};
					expect(note.toJSON()).to.contain.all.keys(["foo", "baz"]);
				});
			});
		});

		describe("mdm payload", function() {
			it("is included in the notification", function() {
				note.mdm = "mdm payload";
				expect(note.toJSON().mdm).to.equal("mdm payload");
			});

			it("does not include the aps payload", function() {
				note.mdm = "mdm payload";
				note.badge = 5;

				expect(note.toJSON()).to.not.have.any.keys("aps");
			});
		});

		describe("aps payload", function() {
			describe("when no aps properties are set", function() {
				it("is not present", function() {
					expect(note.toJSON().aps).to.be.undefined;
				});
			});

			describe("when manual `aps` properties are set on `payload`", function() {
				it("retains them", function() {
					note.payload.aps = {};
					note.payload.aps.custom = "custom property";

					expect(note.toJSON().aps.custom).to.equal("custom property");
				});

				it("adds the alert property", function() {
					note.payload.aps = {};
					note.payload.aps.custom = "custom property";
					note.alert = "test alert";

					expect(note.toJSON().aps.custom).to.equal("custom property");
					expect(note.toJSON().aps.alert).to.equal("test alert");
				});
			});

			it("includes alert text", function() {
				note.alert = "Test Message";
				expect(note.toJSON().aps.alert).to.equal("Test Message");
			});

			it("includes alert object", function() {
				var alert = {
					body: "Test Message"
				};
				note.alert = alert;

				expect(note.toJSON().aps.alert).to.eql(alert);
			});

			it("includes badge value", function() {
				note.badge = 3;

				expect(note.toJSON().aps.badge).to.eql(3);
			});

			it("includes sound value", function() {
				note.sound = "awesome.caf";

				expect(note.toJSON().aps.sound).to.eql("awesome.caf");
			});

			describe("with contentAvailable property", function() {
				it("sets the 'content-available' flag", function() {
					note.contentAvailable = true;
					
					expect(note.toJSON().aps["content-available"]).to.eql(1);
				});
			});

			describe("with contentAvailable property disabled", function() {
				it("does not set the 'content-available' flag", function() {
          note.alert = "message";
					note.contentAvailable = false;
					
					expect(note.toJSON().aps["content-available"]).to.be.undefined;
				});
			});

			describe("with newsstandAvailable property", function() {
				it("sets the 'content-available' flag", function() {
					note.contentAvailable = true;
					
					expect(note.toJSON().aps["content-available"]).to.eql(1);
				});
			});

			it("includes the urlArgs property", function() {
				note.urlArgs = ["arguments", "for", "url"];

				expect(note.toJSON().aps["url-args"]).to.eql(["arguments", "for", "url"]);
			});

			it("includes the category value", function() {
				note.category = "mouse";

				expect(note.toJSON().aps.category).to.eql("mouse");
			});
		});
	});
});

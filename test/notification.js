var apn = require("../");
var sinon = require("sinon");

describe("Notification", function() {

	var note;
	beforeEach(function() {
		note = new apn.Notification();
	});

	describe("aps payload", function() {
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

		describe("with specified length", function() {
			it("trims correctly", function() {
				note.alert = "12345";
				var trimLength = note.length() - 2;
				note.trim(trimLength);
				expect(note.length()).to.equal(trimLength);
			});

			it("trims to length longer than default", function() {
				note.alert = longText + longText;
				var trimLength = 4096;
				note.trim(trimLength);
				expect(note.length()).to.equal(4096);
			});
		})

		describe("alert with escape sequences", function() {
			it("strips correctly", function () {
				note.alert = "\n\n\n";
				var trimLength = note.length() - 2;
				note.trim(trimLength);
				expect(note.length()).to.equal(trimLength);
			});

			it("strips trailing escape characters", function () {
				note.alert = "\n\n\n";
				var trimLength = note.length() - 1;
				note.trim(trimLength);

				var lastChar = note.alert[note.alert.length - 1];
				expect(lastChar).to.not.equal("\\");
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
				it("correctly empties the string", function() {
					note.encoding = "utf16le";
					note.alert = Buffer([0x3D, 0xD8, 0x03, 0xDE, 0x3D, 0xD8, 0x1E, 0xDE]).toString(note.encoding);
					var trimLength = note.length() - 8;
					note.trim(trimLength);

					expect(note.alert.length).to.equal(0);
				});

				it("removes orphaned lead surrogates", function() {
					note.encoding = "utf16le";

					note.alert = Buffer([0x3D, 0xD8, 0x03, 0xDE, 0x3D, 0xD8, 0x1E, 0xDE]).toString(note.encoding);
					var trimLength = note.length() - 2;
					note.trim(trimLength);

					var length = note.alert.length;
					expect(note.alert.charCodeAt(length - 1)).to.not.be.within(0xD800, 0xD8FF);
				});
			});

			describe("escape sequences", function() {
				it("removes sequence without digits", function() {
					note.alert = '\u0006\u0007';
					var trimLength = note.length() - 4;
					note.trim(trimLength);

					expect(note.alert.length).to.equal(1);
				});

				it("removes sequence with fewer than 4 digits", function() {
					note.alert = '\u0006\u0007';
					var trimLength = note.length() - 3;
					note.trim(trimLength);

					expect(note.alert.length).to.equal(1);
				});

				it("does not remove a complete sequence", function() {
					note.alert = '\u0006\u0007 ';
					var trimLength = note.length() - 1;
					note.trim(trimLength);

					expect(note.alert.charCodeAt(1)).to.equal(7);
				});
			});
		});
	});
});

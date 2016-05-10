"use strict";

const Notification = require("../../lib/notification");

describe("Notification", () => {

	let note;
	beforeEach(() => {
		note = new Notification();
	});

	describe("trim", () => {
		describe("when notification payload is below the maximum length", () => {
			it("returns zero",() => {
				note.body = "test message";
				expect(note.trim()).to.equal(0);
			});

			it("does not change the alert text", () => {
				var shortAlert = "This does not need trimming";
				note.body = shortAlert;
				note.trim();

				expect(note.body).to.equal(shortAlert);
			});
		});

		describe("when notification payload is greater than the maximum", () => {
			var longText = "ㅂㅈ ㅐ: LONDON (AP) — E\\\veryone says there areare lots of hidden costs to owning a home. If you own a palace, the costs are royal.\n\nThat became evident when the Buckingham Palace released its accounts Thursday, which showed the monarchy cost British taxpayers 35.7 million pounds ($60.8 million) last year — 56 pence (just under $1) for everyone in the country.\n\nThat is 7.2 percent, or 2.4 million pounds, more than the year before and the increase is mainly explained by the British royal family\'s repair bills.\n\nTheir properties are hardly typical. Buckingham Palace, for example, has 240 bedrooms and 78 bathrooms. That\'s a lot of plumbing to fix when things go wrong.\n\nSo it\'s no surprise that more than a third of the money British taxpayers paid for the monarchy, led by Queen Elizabeth II, was spent on repairs, improvements and maintenance of aging but still opulent palaces.\n\n\"We continue to focus on value for money,\" said Keeper of the Privy Purse Alan Reid, asserting that careful spending habits had allowed for more money to be used for important maintenance work.\n\n\nFILE - In this Saturday, June 14, 2014 file photo, Britain\'s Queen Elizabeth II, foreground, sur …\nA big part of the fixer-upper budget in the 12 months that ended on March 31 went to creating a suitable home for the young family of Prince William, his wife Kate and their toddler Prince George.\n\nSome 3.4 million pounds of taxpayer funds were used to refurbish part of London\'s Kensington Palace for the couple. The extensive work included removing asbestos, installing new heating and redecorating.\n\nThe couple, who have considerable personal financial resources in part because of the estate left by Princess Diana, paid for the carpets, curtains and furniture out of personal funds, the palace said.\n\nIn addition, Prince Charles\' private secretary, William Nye, suggested that Charles and his wife Camilla — who are supported by profits from the extensive Duchy of Cornwall estate — may have helped William and Kate set up their new home.\n\nThe palace accounts also showed the high cost of entertaining on a royal scale: 2 million pounds were spent on \"housekeeping and hospitality\" in the 12 months that ended on March 31.\n---ending ---\n\n";
			describe("with default length", () => {
				it("trims notification text to reduce payload to maximum length", function () {
					note.body = longText + longText;
					note.trim();
					expect(note.length()).to.equal(4096);
				});

				it("trims notification alert body to reduce payload to maximum length", function () {
					note.body = {
						body: longText + longText
					};
					note.trim();
					expect(note.length()).to.equal(4096);
				});
			});

			describe("with custom length", () => {
				it("trims to a shorter length than default", () => {
					note.body = "12345";
					var trimLength = note.length() - 2;
					note.trim(trimLength);
					expect(note.length()).to.equal(trimLength);
				});

				it("trims to a longer length than default", () => {
					note.body = longText + longText + longText;
					var trimLength = 4192;
					note.trim(trimLength);
					expect(note.length()).to.equal(4192);
				});
			});

			describe("with truncateAtWordEnd flag", () => {
				it("removes partially trimmed words", () => {
					note.body = "this is a test payload";
					note.truncateAtWordEnd = true;

					note.trim(note.length() - 3);
					expect(note.body).to.equal("this is a test");
				});

				it("does not truncate when boundary is at end of word", () => {
					note.body = "this is a test payload";
					note.truncateAtWordEnd = true;

					note.trim(note.length() - 8);
					expect(note.body).to.equal("this is a test");
				});

				it("leaves alert intact when there are no other spaces in the string", () => {
					note.body = "this_is_a_test_payload";
					note.truncateAtWordEnd = true;

					note.trim(note.length() - 8);
					expect(note.body).to.equal("this_is_a_test");
				});
			});

			describe("alert contains escape sequences at trim point", () => {
				it("strips them", function () {
					note.body = "\n\n\n";
					var trimLength = note.length() - 2;
					note.trim(trimLength);
					expect(note.body).to.equal("\n\n");
				});
				
				it("leaves escaped escape character intact", () => {
					note.body = "test\\ message";
					note.trim(26);
					expect(note.body).to.equal("test\\");
				});

				it("strips orphaned escape character", function () {
					note.body = "test\\ message";
					note.trim(25);
					expect(note.body).to.equal("test");
				});

				it("leaves an even number of escape characters", () => {
					note.body = "test\\\\\n";
					note.trim(29);
					expect(note.body).to.equal("test\\\\");
				});
			});

			it("returns the number of bytes removed from the alert text", () => {
				note.body = "Test\ud83d\udca3";
				expect(note.trim(25)).to.equal(4);
			});

			describe("with no alert text", () => {
				it("returns the number of bytes too long", () => {
					note.payload.largePayload = "this is a very long payload";
					expect(note.trim(40)).to.equal(-6);
				});
			});

			describe("when alert text is shorter than the length that needs to be removed", () => {
				it("returns the number of bytes too long", () => {
					note.payload.largePayload = "this is a very long payload";
					note.body = "alert";
					expect(note.trim(40)).to.equal(-25);
				});
			});
		});

		describe("unicode text", () => {
			it("trims to maximum byte length", function () {
				note.body = "ㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐㅂㅈ ㅐ";
				note.trim(256);
				expect(note.length()).to.be.at.most(256);
			});

			describe("with UTF-8 encoding", () => {
				it("removes trailing `REPLACEMENT CHARACTER` 0xFFFD", () => {
					note.body = Buffer([0xF0, 0x9F, 0x98, 0x83, 0xF0, 0x9F, 0x98, 0x9E]).toString("utf8");
					var trimLength = note.length() - 1;
					note.trim(trimLength);

					var length = note.body.length;
					expect(note.body.charCodeAt(length - 1)).to.not.equal(0xFFFD);
				});
			});

			describe("with UTF-16LE encoding", () => {
				beforeEach(() => {
					note.encoding = "utf16le";
				});

				it("trims to correct byte length", () => {
					note.body = "test message";
					note.trim(48);

					expect(note.length()).to.equal(48);
				});
				
				it("correctly empties the string", () => {
					note.body = Buffer([0x3D, 0xD8, 0x03, 0xDE, 0x3D, 0xD8, 0x1E, 0xDE]).toString(note.encoding);
					var trimLength = note.length() - 8;
					note.trim(trimLength);

					expect(note.body.length).to.equal(0);
				});

				it("removes orphaned lead surrogates", () => {
					note.body = Buffer([0x3D, 0xD8, 0x03, 0xDE, 0x3D, 0xD8, 0x1E, 0xDE]).toString(note.encoding);
					var trimLength = note.length() - 2;
					note.trim(trimLength);

					var length = note.body.length;
					expect(note.body.charCodeAt(length - 1)).to.not.be.within(0xD800, 0xD8FF);
				});
			});

			describe("escape sequences", () => {
				it("removes sequence without digits", () => {
					note.body = "\u0006\u0007";
					var trimLength = note.length() - 4;
					note.trim(trimLength);

					expect(note.body.length).to.equal(1);
				});

				it("removes sequence with fewer than 4 digits", () => {
					note.body = "\u0006\u0007";
					var trimLength = note.length() - 3;
					note.trim(trimLength);

					expect(note.body.length).to.equal(1);
				});

				it("does not remove a complete sequence", () => {
					note.body = "\u0006\u0007 ";
					var trimLength = note.length() - 1;
					note.trim(trimLength);

					expect(note.body.charCodeAt(1)).to.equal(7);
				});
			});
		});
	});
});
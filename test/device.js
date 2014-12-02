var apn = require("../");

describe("Device", function() {
	describe('constructor', function () {

		// Issue #149
		it("should error when given a device string which contains no hex characters and results in 0 length token", function () {
			expect(function () {
				apn.Device("som string without hx lttrs");
			}).to.throw();
		});

		it("should error when given a device string which contains an odd number of hex characters", function () {
			expect(function () {
				apn.Device("01234");
			}).to.throw();
		});

		it("should return a Device object containing the correct token when given a hex string", function () {
			expect(apn.Device("<0123 4567 89AB CDEF>").toString()).to.equal("0123456789abcdef");
		});

		it("should return a Device object containing the correct token when given a Buffer", function () {
			var buf = new Buffer([1, 35, 69, 103, 137, 171, 205, 239]);
			expect(apn.Device(buf).toString()).to.equal("0123456789abcdef");
		});
	});
});
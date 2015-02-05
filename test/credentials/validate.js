var sinon = require("sinon");
var validateCredentials = require("../../lib/credentials/validate");

describe("validateCredentials", function() {
	var credentials;
	beforeEach(function() {
		credentials = fakeCredentials();
	});

	describe("with valid credentials", function() {
		it("returns", function() {
			expect(function() {
				validateCredentials(credentials);
			}).to.not.throw();
		});
	});

	describe("with mismatched key and certificate", function() {
		it("throws", function() {
			sinon.stub(credentials.certificates[0]._key, "fingerprint").returns("fingerprint2");
			
			expect(function() {
				validateCredentials(credentials);
			}).to.throw(/certificate and key do not match/);
		});
	});

	describe("with expired certificate", function() {
		it("throws", function() {
			sinon.stub(credentials.certificates[0], "validity")
				.returns({
					notBefore: new Date(Date.now() - 100000),
					notAfter: new Date(Date.now() - 10000)
				});

			expect(function() {
				validateCredentials(credentials);
			}).to.throw(/certificate has expired/);
		});
	});

	describe("with incorrect environment", function() {
		it("throws with sandbox cert in production", function() {
			sinon.stub(credentials.certificates[0], "environment")
				.returns({
					production: false,
					sandbox: true
				});

			expect(function() {
				validateCredentials(credentials);
			}).to.throw("certificate does not support configured environment, production: true");
		});

		it("throws with production cert in sandbox", function() {
			sinon.stub(credentials.certificates[0], "environment")
				.returns({
					production: true,
					sandbox: false
				});
			credentials.production = false;

			expect(function() {
				validateCredentials(credentials);
			}).to.throw("certificate does not support configured environment, production: false");
		});
	});

	describe("with missing production flag", function() {
		it("does not throw", function() {
			sinon.stub(credentials.certificates[0], "environment")
				.returns({
					production: true,
					sandbox: false
				});
			credentials.production = undefined;

			expect(function() {
				validateCredentials(credentials);
			}).to.not.throw();
		});
	});

	describe("with certificate supporting both environments", function() {
		it("does not throw", function() {
			sinon.stub(credentials.certificates[0], "environment")
				.returns({
					production: true,
					sandbox: true
				});
			credentials.production = false;

			expect(function() {
				validateCredentials(credentials);
			}).to.not.throw();
		});
	});
});

var fakeCredentials = function() {
	return {
		key: {
			_fingerprint: "fingerprint1",
			fingerprint: function() { return this._fingerprint; },
		},
		certificates: [{
			_key: {
				_fingerprint: "fingerprint1",
				fingerprint: function() { return this._fingerprint; },
			},
			_validity: {
				notBefore: new Date(Date.now() - 100000),
				notAfter: new Date(Date.now() + 100000)
			},
			key: function() { return this._key; },
			validity: function() {
				return this._validity;
			},
			environment: function() {
				return { production: true, sandbox: false };
			}
		}],
		production: true
	};
};

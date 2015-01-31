var sinon = require("sinon");
var validateCredentials = require("../../lib/credentials/validate");

describe("validateCredentials", function() {
	describe("with valid credentials", function() {
		it("returns", function() {
			expect(function() {
				validateCredentials(fakeCredentials);
			}).to.not.throw();
		});
	});

	describe("with mismatched key and certificate", function() {
		it("throws", function() {
			sinon.stub(fakeCredentials.certificates[0]._key, "fingerprint").returns("fingerprint2");
			
			expect(function() {
				validateCredentials(fakeCredentials);
			}).to.throw(/certificate and key do not match/);

			fakeCredentials.certificates[0]._key.fingerprint.restore();
		});
	});

	describe("with expired certificate", function() {
		it("throws", function() {
			sinon.stub(fakeCredentials.certificates[0], "validity")
				.returns({
					notBefore: new Date(Date.now() - 100000),
					notAfter: new Date(Date.now() - 10000)
				});

			expect(function() {
				validateCredentials(fakeCredentials);
			}).to.throw(/certificate has expired/);

			fakeCredentials.certificates[0].validity.restore();
		});
	});

	describe("with incorrect environment", function() {
		afterEach(function() {
			fakeCredentials.certificates[0].environment.restore();
		});

		it("throws with sandbox cert in production", function() {
			sinon.stub(fakeCredentials.certificates[0], "environment")
				.returns({
					production: false,
					sandbox: true
				});

			expect(function() {
				validateCredentials(fakeCredentials);
			}).to.throw("certificate does not support configured environment, production: true");
		});

		it("throws with production cert in sandbox", function() {
			sinon.stub(fakeCredentials.certificates[0], "environment")
				.returns({
					production: true,
					sandbox: false
				});
			fakeCredentials.production = false;

			expect(function() {
				validateCredentials(fakeCredentials);
			}).to.throw("certificate does not support configured environment, production: false");

			fakeCredentials.production = true;
		});
	});

	describe("with certificate supporting both environments", function() {
		afterEach(function() {
			fakeCredentials.certificates[0].environment.restore();
		});
		
		it("does not throw", function() {
			sinon.stub(fakeCredentials.certificates[0], "environment")
				.returns({
					production: true,
					sandbox: true
				});
			fakeCredentials.production = false;

			expect(function() {
				validateCredentials(fakeCredentials);
			}).to.not.throw();

			fakeCredentials.production = true;
		});
	});
});

var fakeCredentials = {
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

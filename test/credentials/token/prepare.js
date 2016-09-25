"use strict";

const sinon = require("sinon");

describe("perpareToken", function () {
  let fakes, prepareToken;

  beforeEach(function () {
    fakes = {
      sign: sinon.stub(),
      resolve: sinon.stub(),
    };

    prepareToken = require("../../../lib/credentials/token/prepare")(fakes);
  });

  const testOptions = {
    key: "key.pem",
    keyId: "123KeyId",
    teamId: "abcTeamId",
  };

  context("with valid options", function() {
    let token;

    beforeEach(function() {
      fakes.resolve.withArgs("key.pem").returns("keyData");
      fakes.sign.returns("generated-token");

      token = prepareToken(testOptions);
    });

    describe("return value", function (){

      describe("`current` property", function () {
        it("is initialized to a signed token", function () {
          expect(token.current).to.have.equal("generated-token");
        });
      });

      describe("`generation` property", function () {
        it("is initialized to 0", function () {
          expect(token.generation).to.equal(0);
        });
      });

      context("`regenerate` called with the current `generation` value", function () {
        let generation;

        beforeEach(function () {
          generation = Math.floor(Math.random() * 10) + 2;

          token.generation = generation;

          fakes.sign.reset();
          fakes.sign.onCall(0).returns("second-token");

          token.regenerate(generation);
        });

        it("increments `generation` property", function () {
          expect(token.generation).to.equal(generation + 1);
        });

        it("invokes the sign method with the correct arguments", function (){
          expect(fakes.sign).to.have.been.calledWith(
            sinon.match({}), // empty payload
            "keyData", 
            sinon.match({
              algorithm: "ES256",
              issuer: "abcTeamId",
              header: sinon.match({
                kid: "123KeyId",
              }),
            })
          );
        });

        it("updates the `current` property to the return value of the sign method", function () {
          expect(token.current).to.equal("second-token");
        });
      });

      context("`regenerate` called with a lower `generation` value", function () {
        let generation;

        beforeEach(function () {
          generation = Math.floor(Math.random() * 10) + 2;

          token.generation = generation;

          fakes.sign.reset();
          fakes.sign.onCall(0).returns("second-token");

          token.regenerate(generation - 1);
        });

        it("does not increment `generation` property", function () {
          expect(token.generation).to.equal(generation);
        });

        it("does not invoke the sign method", function () {
          expect(fakes.sign).to.have.not.been.called;
        });

        it("does not change the `current` property", function () {
          expect(token.current).to.equal("generated-token");
        });
      });
    });
  });

  context("with bad `key` parameter", function () {
    context("key resolution fails", function () {
      it("throws a wrapped error", function () {
        fakes.resolve.withArgs("key.pem").throws(new Error("ENOENT: Unable to read file key.pem"));

        expect(() => prepareToken(testOptions)).to.throw(/Failed loading token key: ENOENT: Unable to read file key.pem/);
      });
    });

    context("key cannot be used for signing", function () {
      it("throws a wrapped error from jwt.sign", function () {
        fakes.sign.throws(new Error("Unable to sign token"));

        expect(() => prepareToken(testOptions)).to.throw(/Failed to generate token: Unable to sign token/);
      });
    });
  });
});

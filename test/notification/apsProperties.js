"use strict";

const Notification = require("../../lib/notification");

describe("Notification", function() {

  let note;
  beforeEach(function() {
    note = new Notification();
  });

  describe("aps convenience properties", function() {
    describe("alert", function() {
      it("defaults to undefined", function() {
        expect(compiledOutput()).to.not.have.deep.property("aps.alert");
      });

      it("can be set to a string", function() {
        note.alert = "hello";
        expect(compiledOutput()).to.have.deep.property("aps.alert", "hello");
      });

      it("can be set to an object", function() {
        note.alert = {"body": "hello"};
        expect(compiledOutput()).to.have.deep.property("aps.alert")
          .that.deep.equals({"body": "hello"});
      });

      it("can be set to undefined", function() {
        note.alert = {"body": "hello"};
        note.alert = undefined;
        expect(compiledOutput()).to.not.have.deep.property("aps.alert");
      });

      describe("setAlert", function () {
        it("is chainable", function () {
          expect(note.setAlert("hello")).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.alert", "hello");
        });
      });
    });

    describe("body", function() {
      it("defaults to undefined", function() {
        expect(note.body).to.be.undefined;
      });

      it("can be set to a string", function() {
        note.body = "Hello, world";
        expect(typeof compiledOutput().aps.alert).to.equal("string");
      });

      it("sets alert as a string by default", function () {
        note.body = "Hello, world";
        expect(compiledOutput()).to.have.deep.property("aps.alert", "Hello, world");
      });

      context("alert is already an Object", function () {
        beforeEach(function () {
          note.alert = {"body": "Existing Body"};
        });

        it("reads the value from alert body", function () {
          expect(note.body).to.equal("Existing Body");
        });

        it("sets the value correctly", function () {
          note.body = "Hello, world";
          expect(compiledOutput()).to.have.deep.property("aps.alert.body", "Hello, world");
        });
      });

      describe("setBody", function () {
        it("is chainable", function () {
          expect(note.setBody("hello")).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.alert", "hello");
        });
      });
    });

    describe("locKey", function () {
      it("sets the aps.alert.loc-key property", function () {
        note.locKey = "hello_world";
        expect(compiledOutput()).to.have.deep.property("aps.alert.loc\-key", "hello_world");
      });

      context("alert is already an object", function () {
        beforeEach(function () {
          note.alert = {body: "Test", "launch-image": "test.png"};
          note.locKey = "hello_world";
        });

        it("contains all expected properties", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert")
            .that.deep.equals({body: "Test", "launch-image": "test.png", "loc-key": "hello_world"});
        });
      });

      context("alert is already a string", function () {
        beforeEach(function () {
          note.alert = "Good Morning";
          note.locKey = "good_morning";
        });

        it("retains the alert body correctly", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.body", "Good Morning");
        });

        it("sets the aps.alert.loc-key property", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.loc\-key", "good_morning");
        });
      });

      describe("setLocKey", function () {
        it("is chainable", function () {
          expect(note.setLocKey("good_morning")).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.alert.loc\-key", "good_morning");
        });
      });
    });

    describe("locArgs", function () {
      it("sets the aps.alert.loc-args property", function () {
        note.locArgs = ["arg1", "arg2"];
        expect(compiledOutput()).to.have.deep.property("aps.alert.loc\-args")
          .that.deep.equals(["arg1", "arg2"]);
      });

      context("alert is already an object", function () {
        beforeEach(function () {
          note.alert = {body: "Test", "launch-image": "test.png"};
          note.locArgs = ["Hi there"];
        });

        it("contains all expected properties", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert")
            .that.deep.equals({body: "Test", "launch-image": "test.png", "loc-args": ["Hi there"]});
        });
      });

      context("alert is already a string", function () {
        beforeEach(function () {
          note.alert = "Hello, world";
          note.locArgs = ["Hi there"];
        });

        it("retains the alert body", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.body", "Hello, world");
        });

        it("sets the aps.alert.loc-args property", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.loc\-args")
            .that.deep.equals(["Hi there"]);
        });
      });

      describe("setLocArgs", function () {
        it("is chainable", function () {
          expect(note.setLocArgs(["Robert"])).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.alert.loc\-args")
            .that.deep.equals(["Robert"]);
        });
      });
    });

    describe("title", function () {
      it("sets the aps.alert.title property", function () {
        note.title = "node-apn";
        expect(compiledOutput()).to.have.deep.property("aps.alert.title", "node-apn");
      });

      context("alert is already an object", function () {
        beforeEach(function () {
          note.alert = {body: "Test", "launch-image": "test.png"};
          note.title = "node-apn";
        });

        it("contains all expected properties", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert")
            .that.deep.equals({body: "Test", "launch-image": "test.png", "title": "node-apn"});
        });
      });

      context("alert is already a string", function () {
        beforeEach(function () {
          note.alert = "Hello, world";
          note.title = "Welcome";
        });

        it("retains the alert body", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.body", "Hello, world");
        });

        it("sets the aps.alert.title property", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.title", "Welcome");
        });
      });

      describe("setTitle", function () {
        it("is chainable", function () {
          expect(note.setTitle("Bienvenue")).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.alert.title", "Bienvenue");
        });
      });
    });

    describe("subtitle", function () {
      it("sets the aps.alert.subtitle property", function () {
        note.subtitle = "node-apn";
        expect(compiledOutput()).to.have.deep.property("aps.alert.subtitle", "node-apn");
      });

      context("alert is already an object", function () {
        beforeEach(function () {
          note.alert = {body: "Test", "launch-image": "test.png"};
          note.subtitle = "node-apn";
        });

        it("contains all expected properties", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert")
            .that.deep.equals({body: "Test", "launch-image": "test.png", "subtitle": "node-apn"});
        });
      });

      context("alert is already a string", function () {
        beforeEach(function () {
          note.alert = "Hello, world";
          note.subtitle = "Welcome";
        });

        it("retains the alert body", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.body", "Hello, world");
        });

        it("sets the aps.alert.subtitle property", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.subtitle", "Welcome");
        });
      });

      describe("setSubtitle", function () {
        it("is chainable", function () {
          expect(note.setSubtitle("Bienvenue")).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.alert.subtitle", "Bienvenue");
        });
      });
    });
    describe("titleLocKey", function () {
      it("sets the aps.alert.title-loc-key property", function () {
        note.titleLocKey = "Warning";
        expect(compiledOutput()).to.have.deep.property("aps.alert.title\-loc\-key", "Warning");
      });

      context("alert is already an object", function () {
        beforeEach(function () {
          note.alert = {body: "Test", "launch-image": "test.png"};
          note.titleLocKey = "Warning";
        });

        it("contains all expected properties", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert")
            .that.deep.equals({body: "Test", "launch-image": "test.png", "title-loc-key": "Warning"});
        });
      });

      context("alert is already a string", function () {
        beforeEach(function () {
          note.alert = "Hello, world";
          note.titleLocKey = "Warning";
        });

        it("retains the alert body correctly", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.body", "Hello, world");
        });

        it("sets the aps.alert.title-loc-key property", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.title\-loc\-key", "Warning");
        });
      });

      describe("setAlert", function () {
        it("is chainable", function () {
          expect(note.setTitleLocKey("greeting")).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.alert.title\-loc\-key", "greeting");
        });
      });
    });

    describe("titleLocArgs", function () {
      it("sets the aps.alert.title-loc-args property", function () {
        note.titleLocArgs = ["arg1", "arg2"];
        expect(compiledOutput()).to.have.deep.property("aps.alert.title\-loc\-args")
          .that.deep.equals(["arg1", "arg2"]);
      });

      context("alert is already an object", function () {
        beforeEach(function () {
          note.alert = {body: "Test", "launch-image": "test.png"};
          note.titleLocArgs = ["Hi there"];
        });

        it("contains all expected properties", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert")
            .that.deep.equals({body: "Test", "launch-image": "test.png", "title-loc-args": ["Hi there"]});
        });
      });

      context("alert is already a string", function () {
        beforeEach(function () {
          note.alert = "Hello, world";
          note.titleLocArgs = ["Hi there"];
        });

        it("retains the alert body", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.body", "Hello, world");
        });

        it("sets the aps.alert.title-loc-args property", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.title\-loc\-args")
            .that.deep.equals(["Hi there"]);
        });
      });

      describe("setTitleLocArgs", function () {
        it("is chainable", function () {
          expect(note.setTitleLocArgs(["iPhone 6s"])).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.alert.title\-loc\-args")
            .that.deep.equals(["iPhone 6s"]);
        });
      });
    });

    describe("action", function () {
      it("sets the aps.alert.action property", function () {
        note.action = "View";
        expect(compiledOutput()).to.have.deep.property("aps.alert.action", "View");
      });

      context("alert is already an object", function () {
        beforeEach(function () {
          note.alert = {body: "Test", "launch-image": "test.png"};
          note.action = "View";
        });

        it("contains all expected properties", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert")
            .that.deep.equals({body: "Test", "launch-image": "test.png", "action": "View"});
        });
      });

      context("alert is already a string", function () {
        beforeEach(function () {
          note.alert = "Alert";
          note.action = "Investigate";
        });

        it("retains the alert body", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.body", "Alert");
        });

        it("sets the aps.alert.action property", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.action", "Investigate");
        });
      });

      describe("setAction", function () {
        it("is chainable", function () {
          expect(note.setAction("Reply")).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.alert.action", "Reply");
        });
      });
    });

    describe("actionLocKey", function () {
      it("sets the aps.alert.action-loc-key property", function () {
        note.actionLocKey = "reply_title";
        expect(compiledOutput()).to.have.deep.property("aps.alert.action\-loc\-key", "reply_title");
      });

      context("alert is already an object", function () {
        beforeEach(function () {
          note.alert = {body: "Test", "launch-image": "test.png"};
          note.actionLocKey = "reply_title";
        });

        it("contains all expected properties", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert")
            .that.deep.equals({body: "Test", "launch-image": "test.png", "action-loc-key": "reply_title"});
        });
      });

      context("alert is already a string", function () {
        beforeEach(function () {
          note.alert = "Hello, world";
          note.actionLocKey = "ignore_title";
        });

        it("retains the alert body correctly", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.body", "Hello, world");
        });

        it("sets the aps.alert.action-loc-key property", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.action\-loc\-key", "ignore_title");
        });
      });

      describe("setActionLocKey", function () {
        it("is chainable", function () {
          expect(note.setActionLocKey("ignore_title")).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.alert.action\-loc\-key", "ignore_title");
        });
      });
    });

    describe("launchImage", function () {
      it("sets the aps.alert.launch-image property", function () {
        note.launchImage = "testLaunch.png";
        expect(compiledOutput()).to.have.deep.property("aps.alert.launch\-image")
          .that.deep.equals("testLaunch.png");
      });

      context("alert is already an object", function () {
        beforeEach(function () {
          note.alert = {body: "Test", "title-loc-key": "node-apn"};
          note.launchImage = "apnLaunch.png";
        });

        it("contains all expected properties", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert")
            .that.deep.equals({body: "Test", "title-loc-key": "node-apn", "launch-image": "apnLaunch.png"});
        });
      });

      context("alert is already a string", function () {
        beforeEach(function () {
          note.alert = "Hello, world";
          note.launchImage = "apnLaunch.png";
        });

        it("retains the alert body", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.body", "Hello, world");
        });

        it("sets the aps.alert.launch-image property", function () {
          expect(compiledOutput()).to.have.deep.property("aps.alert.launch\-image")
            .that.deep.equals("apnLaunch.png");
        })
      });

      describe("setLaunchImage", function () {
        it("is chainable", function () {
          expect(note.setLaunchImage("remoteLaunch.png")).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.alert.launch\-image", "remoteLaunch.png");
        });
      });
    });

    describe("badge", function() {
      it("defaults to undefined", function() {
        expect(compiledOutput()).to.not.have.deep.property("aps.badge");
      });

      it("can be set to a number", function() {
        note.badge = 5;

        expect(compiledOutput()).to.have.deep.property("aps.badge", 5);
      });

      it("can be set to undefined", function() {
        note.badge = 5;
        note.badge = undefined;

        expect(compiledOutput()).to.not.have.deep.property("aps.badge");
      });

      it("can be set to zero", function() {
        note.badge = 0;

        expect(compiledOutput()).to.have.deep.property("aps.badge", 0);
      });

      it("cannot be set to a string", function() {
        note.badge = "hello";

        expect(compiledOutput()).to.not.have.deep.property("aps.badge");
      });

      describe("setBadge", function () {
        it("is chainable", function () {
          expect(note.setBadge(7)).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.badge", 7);
        });
      });
    });

    describe("sound", function() {
      it("defaults to undefined", function() {
        expect(compiledOutput()).to.not.have.deep.property("aps.sound");
      });

      it("can be set to a string", function() {
        note.sound = "sound.caf";

        expect(compiledOutput()).to.have.deep.property("aps.sound", "sound.caf");
      });

      it("can be set to undefined", function() {
        note.sound = "sound.caf";
        note.sound = undefined;

        expect(compiledOutput()).to.not.have.deep.property("aps.sound");
      });

      it("cannot be set to a number", function() {
        note.sound = 5;

        expect(compiledOutput()).to.not.have.deep.property("aps.sound");
      });

      describe("setSound", function () {
        it("is chainable", function () {
          expect(note.setSound("bee.caf")).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.sound", "bee.caf");
        });
      });
    });

    describe("content-available", function() {
      it("defaults to undefined", function() {
        expect(compiledOutput()).to.not.have.deep.property("aps.content\-available");
      });

      it("can be set to a boolean value", function() {
        note.contentAvailable = true;

        expect(compiledOutput()).to.have.deep.property("aps.content\-available", 1);
      });

      it("can be set to `1`", function () {
        note.contentAvailable = 1;

        expect(compiledOutput()).to.have.deep.property("aps.content\-available", 1);
      });

      it("can be set to undefined", function() {
        note.contentAvailable = true;
        note.contentAvailable = undefined;

        expect(compiledOutput()).to.not.have.deep.property("aps.content\-available");
      });

      describe("setContentAvailable", function () {
        it("is chainable", function () {
          expect(note.setContentAvailable(true)).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.content\-available", 1);
        });
      });
    });

    describe("mutable-content", function() {
      it("defaults to undefined", function() {
        expect(compiledOutput()).to.not.have.deep.property("aps.mutable\-content");
      });

      it("can be set to a boolean value", function() {
        note.mutableContent = true;

        expect(compiledOutput()).to.have.deep.property("aps.mutable\-content", 1);
      });

      it("can be set to `1`", function () {
        note.mutableContent = 1;

        expect(compiledOutput()).to.have.deep.property("aps.mutable\-content", 1);
      });

      it("can be set to undefined", function() {
        note.mutableContent = true;
        note.mutableContent = undefined;

        expect(compiledOutput()).to.not.have.deep.property("aps.mutable\-content");
      });

      describe("setMutableContent", function () {
        it("is chainable", function () {
          expect(note.setMutableContent(true)).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.mutable\-content", 1);
        });
      });
    });

    describe("mdm", function() {
      it("defaults to undefined", function() {
        expect(compiledOutput()).to.not.have.deep.property("mdm");
      });

      it("can be set to a string", function() {
        note.mdm = "mdm payload";

        expect(compiledOutput()).to.deep.equal({"mdm": "mdm payload"});
      });

      it("can be set to undefined", function() {
        note.mdm = "mdm payload";
        note.mdm = undefined;

        expect(compiledOutput()).to.not.have.deep.property("mdm");
      });

      it("does not include the aps payload", function() {
        note.mdm = "mdm payload";
        note.badge = 5;

        expect(compiledOutput()).to.not.have.any.keys("aps");
      });

      describe("setMdm", function () {
        it("is chainable", function () {
          expect(note.setMdm("hello")).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("mdm", "hello");
        });
      });
    });

    describe("urlArgs", function() {
      it("defaults to undefined", function() {
        expect(compiledOutput()).to.not.have.deep.property("aps.url\-args");
      });

      it("can be set to an array", function() {
        note.urlArgs = ["arg1", "arg2"];

        expect(compiledOutput()).to.have.deep.property("aps.url\-args")
          .that.deep.equals(["arg1", "arg2"]);
      });

      it("can be set to undefined", function() {
        note.urlArgs = ["arg1", "arg2"];
        note.urlArgs = undefined;

        expect(compiledOutput()).to.not.have.deep.property("aps.url\-args");
      });

      describe("setUrlArgs", function () {
        it("is chainable", function () {
          expect(note.setUrlArgs(["A318", "BA001"])).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.url\-args")
            .that.deep.equals(["A318", "BA001"]);
        });
      });
    });

    describe("category", function() {
      it("defaults to undefined", function() {
        expect(compiledOutput()).to.not.have.deep.property("aps.category");
      });

      it("can be set to a string", function() {
        note.category = "the-category";
        expect(compiledOutput()).to.have.deep.property("aps.category", "the-category");
      });

      it("can be set to undefined", function() {
        note.category = "the-category";
        note.category = undefined;
        expect(compiledOutput()).to.not.have.deep.property("aps.category");
      });

      describe("setCategory", function () {
        it("is chainable", function () {
          expect(note.setCategory("reminder")).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.category", "reminder");
        });
      });
    });

    describe("thread-id", function() {
      it("defaults to undefined", function() {
        expect(compiledOutput()).to.not.have.deep.property("aps.thread\-id");
      });

      it("can be set to a string", function() {
        note.threadId = "the-thread-id";

        expect(compiledOutput()).to.have.deep.property("aps.thread\-id", "the-thread-id");
      });

      it("can be set to undefined", function() {
        note.threadId = "the-thread-id";
        note.threadId = undefined;

        expect(compiledOutput()).to.not.have.deep.property("aps.thread\-id");
      });

      describe("setThreadId", function () {
        it("is chainable", function () {
          expect(note.setThreadId("the-thread-id")).to.equal(note);
          expect(compiledOutput()).to.have.deep.property("aps.thread\-id", "the-thread-id");
        });
      });
    });

    context("when no aps properties are set", function() {
      it("is not present", function() {
        expect(compiledOutput().aps).to.be.undefined;
      });
    });
  });

  function compiledOutput() {
    return JSON.parse(note.compile());
  }
});

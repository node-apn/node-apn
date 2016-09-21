"use strict";

const apn = require('apn');

let tokens = ["<insert token here>", "<insert token here>"];
if(tokens[0] === "<insert token here>") {
    console.log("Please set token to a valid device token for the push notification service");
    process.exit();
}

let service = new apn.Provider({
  cert: "certificates/cert.pem",
  key: "certificates/key.pem",
});

let note = new apn.Notification();
note.alert = "This is a test";
note.topic = "<app bundle topic>";

console.log(`Sending: ${note.compile()} to ${tokens}`);
service.send(note, tokens).then( result => {
    console.log("sent:", result.sent.length);
    console.log("failed:", result.failed.length);
    console.log(result.failed);
});

setTimeout( () => {
  service.shutdown();
}, 10);

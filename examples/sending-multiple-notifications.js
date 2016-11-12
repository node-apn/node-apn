"use strict";

/**

Send individualised notifications

i.e. Account updates for users with one-or-more device tokens
*/

const apn = require("apn");

let users = [
  { name: "Wendy", "devices": ["<insert device token>", "<insert device token>"]},
  { name: "John",  "devices": ["<insert device token>"]},
];

let service = new apn.Provider({
  cert: "certificates/cert.pem",
  key: "certificates/key.pem",
});

users.forEach( (user) => {

  let note = new apn.Notification();
  note.alert = `Hey ${user.name}, I just sent my first Push Notification`;

  // The topic is usually the bundle identifier of your application.
  note.topic = "<bundle identifier>";

  console.log(`Sending: ${note.compile()} to ${user.devices}`);

  service.send(note, user.devices).then( result => {
      console.log("sent:", result.sent.length);
      console.log("failed:", result.failed.length);
      console.log(result.failed);
  });
});

// For one-shot notification tasks you may wish to shutdown the connection
// after everything is sent, but only call shutdown if you need your
// application to terminate.
service.shutdown();

var apn = require('../index.js');

var note = new apn.notification();

var longString = "Hello multiple" ;

console.log(note.truncateStringToLength(longString, 10));
console.log(note.truncateStringToLength(longString, 4));

console.log(note.truncateStringToLength(longString, 10 , true));
console.log(note.truncateStringToLength(longString, 4 , true));
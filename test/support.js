"use strict";

var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");

chai.config.includeStack = true;
chai.use(chaiAsPromised);

global.expect = chai.expect;
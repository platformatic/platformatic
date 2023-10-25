'use strict'

const { BaseGenerator } = require('./lib/base-generator')
const { generateTests } = require('./lib/create-plugin')
const { addPrefixToEnv } = require('./lib/utils')
module.exports = {
  addPrefixToEnv,
  BaseGenerator,
  generateTests
}

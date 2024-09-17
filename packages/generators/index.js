'use strict'

const { BaseGenerator } = require('./lib/base-generator')
const { generateTests } = require('./lib/create-plugin')
const utils = require('./lib/utils')
module.exports = {
  BaseGenerator,
  generateTests,
  ...utils,
}

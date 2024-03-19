'use strict'

const { BaseGenerator } = require('./lib/base-generator')
const { StackableGenerator } = require('./lib/stackable-generator')
const { generateTests } = require('./lib/create-plugin')
const utils = require('./lib/utils')
module.exports = {
  BaseGenerator,
  StackableGenerator,
  generateTests,
  ...utils
}

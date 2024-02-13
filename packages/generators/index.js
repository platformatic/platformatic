'use strict'

const { BaseGenerator } = require('./lib/base-generator')
const { StackableGenerator } = require('./lib/stackable-generator')
const { generateTests } = require('./lib/create-plugin')

module.exports = {
  BaseGenerator,
  StackableGenerator,
  generateTests
}

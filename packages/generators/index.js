'use strict'

const { BaseGenerator } = require('./lib/base-generator')
const { ImportGenerator } = require('./lib/import-generator')
const { generateTests } = require('./lib/create-plugin')
const utils = require('./lib/utils')

module.exports = {
  BaseGenerator,
  ImportGenerator,
  generateTests,
  ...utils
}

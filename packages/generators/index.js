'use strict'

const { BaseGenerator } = require('./lib/base-generator')
const { FallbackGenerator } = require('./lib/fallback-generator')
const { generateTests } = require('./lib/create-plugin')
const utils = require('./lib/utils')

module.exports = {
  BaseGenerator,
  FallbackGenerator,
  generateTests,
  ...utils
}

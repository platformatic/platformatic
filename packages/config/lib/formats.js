'use strict'

const errors = require('./errors.js')
const { extname } = require('path')

function quoteYamlBraces (yamlString) {
  const bracesRegexp = /{(\d+|[a-z$_][\w\-$]*?(?:\.[\w\-$]*?)*?)}/gi
  const stringRegexp = /(["'])(?:(?=(\\?))\2.)*?\1/gi

  const stringMatches = [...yamlString.matchAll(stringRegexp)]

  return yamlString.replace(bracesRegexp, (match, p1, offset) => {
    for (const stringMatch of stringMatches) {
      const stringStart = stringMatch.index
      const stringEnd = stringMatch.index + stringMatch[0].length
      if (offset >= stringStart && offset <= stringEnd) return match
    }
    return `'${match}'`
  })
}

module.exports.quoteYamlBraces = quoteYamlBraces

function getParser (path) {
  switch (extname(path)) {
    case '.yaml':
    case '.yml':
      const YAML = require('yaml')
      return (string, ...args) => YAML.parse(quoteYamlBraces(string), ...args)
    case '.json':
      return JSON.parse
    case '.json5':
      const JSON5 = require('json5')
      return JSON5.parse
    case '.toml':
    case '.tml':
      const TOML = require('@iarna/toml')
      return TOML.parse
    default:
      throw new errors.InvalidConfigFileExtensionError()
  }
  /* c8 ignore next 1 */
}

module.exports.getParser = getParser

function getStringifier (path) {
  /* eslint no-case-declarations: off */
  switch (extname(path)) {
    case '.yaml':
    case '.yml':
      const YAML = require('yaml')
      return YAML.stringify
    case '.json':
      return (data) => JSON.stringify(data, null, 2)
    case '.json5':
      const JSON5 = require('json5')
      return (data) => JSON5.stringify(data, null, 2)
    case '.toml':
    case '.tml':
      const TOML = require('@iarna/toml')
      return TOML.stringify
    default:
      throw new errors.InvalidConfigFileExtensionError()
  }
  /* c8 ignore next 1 */
}

module.exports.getStringifier = getStringifier

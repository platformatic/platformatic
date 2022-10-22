'use strict'

const { singularize } = require('inflected')
const camelcase = require('camelcase')

function toSingular (str) {
  str = camelcase(singularize(str))
  str = str[0].toUpperCase() + str.slice(1)
  return str
}

/**
 * If limit is not defined or invalid
 * let's set a safe default value preventing to load huge amount of data in memory
 */
function sanitizeLimit (limit) {
  const maxLimitValue = 100
  if (limit !== undefined && limit >= 0) {
    return limit <= maxLimitValue ? limit : maxLimitValue
  }

  return 10
}

module.exports = {
  toSingular,
  sanitizeLimit
}

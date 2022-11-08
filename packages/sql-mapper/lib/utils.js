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
function sanitizeLimit (unsafeLimit, conf) {
  const defaultLimit = conf?.default ?? 10
  const limit = (unsafeLimit !== undefined) ? unsafeLimit : defaultLimit
  const max = conf?.max ?? 100

  if (limit > max) {
    throw new Error(`Param limit=${limit} not allowed. Max accepted value ${max}.`)
  }

  if (limit < 0) {
    throw new Error(`Param limit=${limit} not allowed. It must be not negative value.`)
  }

  return limit
}

module.exports = {
  toSingular,
  sanitizeLimit
}

'use strict'

const { singularize } = require('inflected')
const camelcase = require('camelcase')
const errors = require('./errors')

function toUpperFirst (str) {
  return str[0].toUpperCase() + str.slice(1)
}

function toSingular (str) {
  str = camelcase(singularize(str))
  str = toUpperFirst(str)
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
    throw new errors.ParamLimitNotAllowedError(limit, max)
  }

  if (limit < 0) {
    throw new errors.ParamLimitMustBeNotNegativeError(limit)
  }

  return limit
}

function tableName (sql, table, schema) {
  /* istanbul ignore next */
  return schema ? sql.ident(schema, table) : sql.ident(table)
}

function areSchemasSupported (sql) {
  return !sql.isSQLite
}

module.exports = {
  toSingular,
  toUpperFirst,
  sanitizeLimit,
  tableName,
  areSchemasSupported
}

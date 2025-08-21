import camelcase from 'camelcase'
import { singularize } from 'inflected'
import { ParamLimitMustBeNotNegativeError, ParamLimitNotAllowedError } from './errors.js'

export function toUpperFirst (str) {
  str = str.toString()
  return str[0].toUpperCase() + str.slice(1)
}

export function toLowerFirst (str) {
  str = str.toString()
  return str.charAt(0).toLowerCase() + str.slice(1)
}

export function toSingular (str) {
  str = camelcase(singularize(str))
  str = toUpperFirst(str)
  return str
}

/**
 * If limit is not defined or invalid
 * let's set a safe default value preventing to load huge amount of data in memory
 */
export function sanitizeLimit (unsafeLimit, conf) {
  const defaultLimit = conf?.default ?? 10
  const limit = unsafeLimit !== undefined ? unsafeLimit : defaultLimit
  const max = conf?.max ?? 100

  if (limit > max) {
    throw new ParamLimitNotAllowedError(limit, max)
  }

  if (limit < 0) {
    throw new ParamLimitMustBeNotNegativeError(limit)
  }

  return limit
}

export function tableName (sql, table, schema) {
  /* istanbul ignore next */
  return schema ? sql.ident(schema, table) : sql.ident(table)
}

export function areSchemasSupported (sql) {
  return !sql.isSQLite
}

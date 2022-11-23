'use strict'

const { mapSQLTypeToOpenAPIType } = require('@platformatic/sql-json-schema-mapper')

function generateArgs (entity) {
  const sortedEntityFields = Object.keys(entity.fields).sort()

  const whereArgs = sortedEntityFields.reduce((acc, name) => {
    const field = entity.fields[name]
    const baseKey = `where.${field.camelcase}.`
    for (const modifier of ['eq', 'neq', 'gt', 'gte', 'lt', 'lte']) {
      const key = baseKey + modifier
      acc[key] = { type: mapSQLTypeToOpenAPIType(field.sqlType), enum: field.enum }
    }

    for (const modifier of ['in', 'nin']) {
      const key = baseKey + modifier
      acc[key] = { type: 'string' }
    }

    return acc
  }, {})

  const orderByArgs = sortedEntityFields.reduce((acc, name) => {
    const field = entity.fields[name]
    const key = `orderby.${field.camelcase}`
    acc[key] = { type: 'string', enum: ['asc', 'desc'] }
    return acc
  }, {})

  return { whereArgs, orderByArgs }
}

module.exports.generateArgs = generateArgs

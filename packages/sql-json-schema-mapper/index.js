'use strict'

function mapSQLTypeToOpenAPIType (sqlType) {
  // TODO support more types
  /* istanbul ignore next */
  switch (sqlType) {
    case 'int':
      return 'integer'
    case 'integer':
      return 'integer'
    case 'tinyint':
      return 'integer'
    case 'smallint':
      return 'integer'
    case 'decimal':
      return 'integer'
    case 'bigint':
      return 'integer'
    case 'int2':
      return 'integer'
    case 'int4':
      return 'integer'
    case 'varchar':
      return 'string'
    case 'text':
      return 'string'
    case 'bool':
      return 'boolean'
    case 'real':
      return 'number'
    case 'float8':
      return 'number'
    case 'double':
      return 'number'
    case 'double precision':
      return 'number'
    case 'numeric':
      return 'number'
    case 'bigint unsigned':
      return 'integer'
    case 'float4':
      return 'number'
    case 'date':
      return 'string'
    case 'time':
      return 'string'
    case 'timestamp':
      return 'string'
    case 'uuid':
      return 'string'
    default:
      return 'string'
  }
}

function mapSQLEntityToJSONSchema (entity, ignore = {}) {
  const fields = entity.fields
  const properties = {}
  const required = []
  for (const name of Object.keys(fields)) {
    const field = fields[name]
    if (ignore[name] === true) {
      continue
    }
    const type = mapSQLTypeToOpenAPIType(field.sqlType)
    /* istanbul ignore next */
    if (field.sqlType === 'json') {
      properties[field.camelcase] = {
        type: 'object',
        additionalProperties: true
      }
    } else {
      properties[field.camelcase] = { type }
    }
    if (field.isNullable) {
      properties[field.camelcase].nullable = true
    }
    if (!field.isNullable && !field.primaryKey) {
      // we skip the primary key for creation
      required.push(field.camelcase)
    }
    /* istanbul ignore next */
    if (field.enum) {
      properties[field.camelcase].enum = field.enum
    }
  }
  return {
    $id: entity.name,
    title: entity.name,
    description: `A ${entity.name}`,
    type: 'object',
    properties,
    required
  }
}

module.exports = { mapSQLTypeToOpenAPIType, mapSQLEntityToJSONSchema }

'use strict'

const CodeBlockWriter = require('code-block-writer').default
const { property } = require('safe-identifier')

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
      return 'string'
    case 'bigint':
      return 'string'
    case 'int2':
      return 'integer'
    case 'int4':
      return 'integer'
    case 'int8':
      return 'string'
    case 'integer unsigned':
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
      return 'string'
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

function mapSQLEntityToJSONSchema (entity, ignore = {}, noRequired = false) {
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
    if (field.isArray) {
      properties[field.camelcase] = {
        type: 'array',
        items: {
          type
        }
      }
    } else if (field.sqlType === 'json') {
      properties[field.camelcase] = {
        type: 'object',
        additionalProperties: true
      }
    } else {
      properties[field.camelcase] = { type }
    }
    if (field.isNullable || noRequired) {
      properties[field.camelcase].nullable = true
    }
    if (!field.isNullable && !field.primaryKey && !noRequired) {
      // we skip the primary key for creation
      required.push(field.camelcase)
    }
    if (field.isGenerated) {
      properties[field.camelcase].readOnly = true
    }
    /* istanbul ignore next */
    if (field.enum) {
      properties[field.camelcase].enum = field.enum
    }
  }

  const res = {
    $id: entity.name,
    title: entity.name,
    description: `A ${entity.name}`,
    type: 'object',
    properties
  }

  if (required.length > 0) {
    res.required = required
  }

  return res
}

function mapOpenAPItoTypes (obj, fieldDefinitions, opts = {}) {
  let { writer, addedProps } = opts
  addedProps ??= new Set()
  writer ??= new CodeBlockWriter()
  const { title, description, properties, required, additionalProperties } = obj
  writer.write('/**').newLine()
  writer.write(` * ${title}`).newLine()
  writer.write(` * ${description}`).newLine()
  writer.write(' */').newLine()
  writer.write(`declare interface ${title}`).block(() => {
    renderProperties(writer, addedProps, properties, additionalProperties, required, fieldDefinitions)
  })
  return writer.toString()
}

function renderProperties (writer, addedProps, properties = {}, additionalProperties, required = [], fieldDefinitions = {}) {
  // Since Array.prototype.sort is guaranteed to be stable, we can sort by name first, then apply special sorting rules
  const keys = Object.keys(properties)
    .sort()
    .sort((a, b) => {
      // Sort PKs first
      if (fieldDefinitions[a]?.primaryKey === fieldDefinitions[b]?.primaryKey) {
        return 0
      }
      return fieldDefinitions[a]?.primaryKey ? -1 : 1
    })
  for (const name of keys) {
    const localProperty = properties[name]
    const { type, nullable, items } = localProperty
    addedProps.add(name)
    if (required.indexOf(name) !== -1) {
      writer.write(property(null, name))
    } else {
      writer.write(property(null, name))
      writer.write('?')
    }

    let types
    if (Array.isArray(type)) {
      types = type
    } else {
      types = [type]
    }

    if (nullable && types.indexOf('null') === -1) {
      types.push('null')
    }

    let first = true
    writer.write(': ')
    for (const type of types) {
      if (!first) {
        writer.write(' | ')
      }
      first = false
      if (type === 'null') {
        writer.write('null')
      } else if (type === 'array') {
        switch (items.type) {
          case 'object':
            writer.inlineBlock(() => {
              const current = items
              renderProperties(writer, addedProps, current.properties, current.additionalProperties, current.required)
            })
            writer.write('[]')
            break
            // TODO support arrays in arrays
          default:
            writer.write(`${JSONSchemaToTsType(items.type)}[]`)
        }
      } else if (type === 'object') {
        writer.inlineBlock(() => {
          const current = properties[name]
          renderProperties(writer, addedProps, current.properties, current.additionalProperties, current.required)
        })
      } else if (type === 'string' && localProperty.enum) {
        writer.write(localProperty.enum.sort().map((v) => `"${v}"`).join(' | '))
      } else {
        writer.write(JSONSchemaToTsType(type))
      }
    }

    writer.write(';')
    writer.newLine()
  }

  if (additionalProperties) {
    writer.write('[name: string]: any;')
  }
}

function JSONSchemaToTsType (type) {
  switch (type) {
    case 'string':
      return 'string'
    case 'integer':
      return 'number'
    case 'number':
      return 'number'
    /* istanbul ignore next */
    case 'boolean':
      return 'boolean'
    // TODO what other types should we support here?
    /* istanbul ignore next */
    default:
      return 'any'
  }
}

module.exports = { mapSQLTypeToOpenAPIType, mapSQLEntityToJSONSchema, mapOpenAPItoTypes }

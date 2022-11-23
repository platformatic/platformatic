'use strict'

const { mapSQLTypeToOpenAPIType } = require('@platformatic/sql-json-schema-mapper')
const camelcase = require('camelcase')
const { singularize } = require('inflected')
const { generateArgs } = require('./shared')

const getFieldsForEntity = (entity) => ({
  type: 'array',
  items: {
    type: 'string',
    enum: Object.keys(entity.fields).map((field) => entity.fields[field].camelcase).sort()
  }
})

async function entityPlugin (app, opts) {
  const entity = opts.entity

  const entitySchema = {
    $ref: entity.name + '#'
  }
  const primaryKeysParams = getPrimaryKeysParams(entity)
  const primaryKeysCamelcase = Array.from(entity.primaryKeys).map((key) => camelcase(key))

  const { whereArgs, orderByArgs } = generateArgs(entity)

  const fields = getFieldsForEntity(entity)

  app.get('/', {
    schema: {
      operationId: 'get' + capitalize(entity.pluralName),
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer' },
          offset: { type: 'integer' },
          totalCount: { type: 'boolean', default: false },
          fields,
          ...whereArgs,
          ...orderByArgs
        },
        additionalProperties: false
      },
      response: {
        200: {
          type: 'array',
          items: entitySchema
        }
      }
    }
  }, async function (request, reply) {
    const query = request.query
    const { limit, offset, fields } = query
    const queryKeys = Object.keys(query)
    const where = {}
    const orderBy = []

    for (let i = 0; i < queryKeys.length; i++) {
      const key = queryKeys[i]

      if (key.startsWith('where.')) {
        const [, field, modifier] = key.split('.')
        where[field] ||= {}
        let value = query[key]
        if (modifier === 'in' || modifier === 'nin') {
          // TODO handle escaping of ,
          value = query[key].split(',')
          if (mapSQLTypeToOpenAPIType(entity.fields[field].sqlType) === 'integer') {
            value = value.map((v) => parseInt(v))
          }
        }
        where[field][modifier] = value
      } else if (key.startsWith('orderby.')) {
        const [, field] = key.split('.')
        orderBy[field] ||= {}
        orderBy.push({ field, direction: query[key] })
      }
    }

    const ctx = { app: this, reply }
    const res = await entity.find({ limit, offset, fields, orderBy, where, ctx })

    // X-Total-Count header
    if (query.totalCount) {
      let totalCount
      if ((((offset ?? 0) === 0) || (res.length > 0)) && ((limit === undefined) || (res.length < limit))) {
        totalCount = (offset ?? 0) + res.length
      } else {
        totalCount = await entity.count({ where, ctx })
      }
      reply.header('X-Total-Count', totalCount)
    }

    return res
  })

  app.post('/', {
    schema: {
      body: entitySchema,
      response: {
        200: entitySchema
      }
    }
  }, async function (request, reply) {
    const ctx = { app: this, reply }
    const res = await entity.save({ input: request.body, ctx })
    reply.header('location', `${app.prefix}/${res.id}`)
    return res
  })

  let pathWithParams = ''

  for (const key of entity.primaryKeys) {
    const camelcaseKey = camelcase(key)
    const relation = entity.relations.find((relation) => relation.column_name === key)
    if (relation) {
      pathWithParams += `/${camelcase(singularize(relation.foreign_table_name))}/:${camelcaseKey}`
    } else {
      pathWithParams += `/${camelcaseKey}/:${camelcaseKey}`
    }
  }

  const operationName = primaryKeysCamelcase.reduce((acc, key) => {
    if (acc !== '') {
      acc += 'And'
    }
    return acc + capitalize(key)
  }, '')

  app.get(pathWithParams, {
    schema: {
      operationId: `get${entity.name}By${operationName}`,
      params: primaryKeysParams,
      querystring: {
        type: 'object',
        properties: {
          fields
        }
      },
      response: {
        200: entitySchema
      }
    }
  }, async function (request, reply) {
    const ctx = { app: this, reply }
    const res = await entity.find({
      ctx,
      where: primaryKeysCamelcase.reduce((acc, key) => {
        acc[key] = { eq: request.params[key] }
        return acc
      }, {}),
      fields: request.query.fields
    })
    if (res.length === 0) {
      return reply.callNotFound()
    }
    return res[0]
  })

  for (const method of ['POST', 'PUT']) {
    app.route({
      url: pathWithParams,
      method,
      schema: {
        body: entitySchema,
        params: primaryKeysParams,
        querystring: {
          type: 'object',
          properties: {
            fields
          }
        },
        response: {
          200: entitySchema
        }
      },
      async handler (request, reply) {
        const ids = primaryKeysCamelcase.map((key) => { return { key, value: request.params[key] } })
        const ctx = { app: this, reply }
        const res = await entity.save({
          ctx,
          input: {
            ...request.body,
            ...(ids.reduce((acc, { key, value }) => {
              acc[key] = value
              return acc
            }, {}))
          },
          where: ids.reduce((acc, { key, value }) => {
            acc[key] = { eq: value }
            return acc
          }, {}),
          fields: request.query.fields
        })
        if (!res) {
          return reply.callNotFound()
        }
        let location = ''
        for (const key of primaryKeysCamelcase) {
          location += `/${key}/${res[key]}`
        }
        reply.header('location', `${app.prefix}/${location}`)
        return res
      }
    })
  }

  /*
  app.put('/', {
    schema: {
      body: entitySchema,
      querystring: {
        type: 'object',
        properties: {
          fields,
          ...whereArgs
        },
        additionalProperties: false
      },
      response: {
        200: {
          type: 'array',
          items: entitySchema
        }
      }
    },
    async handler (request, reply) {
      const ctx = { app: this, reply }
      const query = request.query
      const queryKeys = Object.keys(query)
      const where = {}

      for (let i = 0; i < queryKeys.length; i++) {
        const key = queryKeys[i]
        if (key.startsWith('where.')) {
          const [, field, modifier] = key.split('.')
          where[field] ||= {}
          let value = query[key]
          if (modifier === 'in' || modifier === 'nin') {
            // TODO handle escaping of ,
            value = query[key].split(',')
            if (mapSQLTypeToOpenAPIType(entity.fields[field].sqlType) === 'integer') {
              value = value.map((v) => parseInt(v))
            }
          }
          where[field][modifier] = value
        }
      }

      const res = await entity.updateMany({
        input: {
          ...request.body
        },
        where,
        fields: request.query.fields,
        ctx
      })
      // TODO: Should find a way to test this line
      // if (!res) return reply.callNotFound()
      reply.header('location', `${app.prefix}`)
      return res
    }
  })

  app.delete(`/:${primaryKeyCamelcase}`, {
    schema: {
      params: primaryKeyParams,
      querystring: {
        type: 'object',
        properties: {
          fields
        }
      },
      response: {
        200: entitySchema
      }
    }
  }, async function (request, reply) {
    const ctx = { app: this, reply }
    const res = await entity.delete({
      ctx,
      where: {
        [primaryKeyCamelcase]: {
          eq: request.params[primaryKeyCamelcase]
        }
      },
      fields: request.query.fields
    })
    if (res.length === 0) {
      return reply.callNotFound()
    }
    return res[0]
  })
  */
}

function getPrimaryKeysParams (entity) {
  const properties = {}
  const primaryKeys = entity.primaryKeys
  const fields = entity.fields
  const required = []
  for (const key of primaryKeys) {
    const field = fields[key]
    properties[field.camelcase] = { type: mapSQLTypeToOpenAPIType(field.sqlType) }
    required.push(field.camelcase)
  }

  return {
    type: 'object',
    properties,
    required
  }
}

function capitalize (str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

module.exports = entityPlugin

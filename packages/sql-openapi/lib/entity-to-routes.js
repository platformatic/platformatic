'use strict'

const { mapSQLTypeToOpenAPIType } = require('@platformatic/sql-json-schema-mapper')
const camelcase = require('camelcase')
const { singularize } = require('inflected')

async function entityPlugin (app, opts) {
  const entity = opts.entity

  const entitySchema = {
    $ref: entity.name + '#'
  }
  const primaryKeyParams = getPrimaryKeyParams(entity)
  const entityLinks = {}
  const primaryKeyCamelcase = camelcase(entity.primaryKey)

  for (const relation of entity.relations) {
    const ownField = camelcase(relation.column_name)
    const relatedEntity = app.platformatic.entities[camelcase(singularize(relation.foreign_table_name))]
    const relatedEntityPrimaryKeyCamelcase = capitalize(camelcase(relatedEntity.primaryKey))
    const getEntityById = `Get${relatedEntity.name}With${relatedEntityPrimaryKeyCamelcase}`
    entityLinks[getEntityById] = {
      operationId: `get${relatedEntity.name}By${relatedEntityPrimaryKeyCamelcase}`,
      parameters: {
        [primaryKeyCamelcase]: `$response.body#/${ownField}`
      }
    }
  }

  for (const relationship of entity.reverseRelationships) {
    const relation = relationship.relation
    const theirField = camelcase(relation.column_name)
    const ownField = camelcase(relation.foreign_column_name)
    const relatedEntity = app.platformatic.entities[camelcase(singularize(relation.table_name))]
    const getAllEntities = `GetAll${capitalize(relatedEntity.pluralName)}`
    entityLinks[getAllEntities] = {
      operationId: `getAll${capitalize(relatedEntity.pluralName)}`,
      parameters: {
        [`where.${theirField}.eq`]: `$response.body#/${ownField}`
      }
    }
  }

  const whereArgs = Object.keys(entity.fields).sort().map((name) => {
    return entity.fields[name]
  }).reduce((acc, field) => {
    const baseKey = `where.${field.camelcase}.`
    for (const modifier of ['eq', 'neq', 'gt', 'gte', 'lt', 'lte']) {
      const key = baseKey + modifier
      acc[key] = { type: mapSQLTypeToOpenAPIType(field.sqlType) }
    }

    for (const modifier of ['in', 'nin']) {
      const key = baseKey + modifier
      acc[key] = { type: 'string' }
    }

    return acc
  }, {})

  const orderByArgs = Object.keys(entity.fields).sort().map((name) => {
    return entity.fields[name]
  }).reduce((acc, field) => {
    const key = `orderby.${field.camelcase}`
    acc[key] = { type: 'string', enum: ['asc', 'desc'] }
    return acc
  }, {})

  app.addHook('preValidation', async (req) => {
    if (typeof req.query.fields === 'string') {
      req.query.fields = req.query.fields.split(',')
    }
  })

  const fields = {
    type: 'array',
    items: {
      type: 'string',
      enum: Object.keys(entity.fields).map((field) => entity.fields[field].camelcase).sort()
    }
  }

  app.get('/', {
    schema: {
      operationId: 'getAll' + entity.name,
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
    // TODO computing this where clause will be slow
    // refactor to use a barebone for(;;) loop
    const where = Object.keys(query).reduce((acc, key) => {
      if (key.indexOf('where.') === 0) {
        const [, field, modifier] = key.split('.')
        acc[field] = acc[field] || {}
        let value = query[key]
        if (modifier === 'in' || modifier === 'nin') {
          // TODO handle escaping of ,
          value = query[key].split(',')
          if (mapSQLTypeToOpenAPIType(entity.fields[field].sqlType) === 'integer') {
            value = value.map((v) => parseInt(v))
          }
        }
        acc[field][modifier] = value
        return acc
      }
      return acc
    }, {})
    const orderBy = Object.keys(query).reduce((acc, key) => {
      if (key.indexOf('orderby.') === 0) {
        const [, field] = key.split('.')
        acc[field] = acc[field] || {}
        acc.push({ field, direction: query[key] })
      }
      return acc
    }, [])
    const ctx = { app: this, reply }
    const res = await entity.find({ limit, offset, fields, orderBy, where, ctx })
    if (query.totalCount) {
      const totalCount = await entity.findTotalCount({ where, ctx })
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
    },
    links: {
      200: entityLinks
    }
  }, async function (request, reply) {
    const ctx = { app: this, reply }
    const res = await entity.save({ input: request.body, ctx })
    reply.header('location', `${app.prefix}/${res.id}`)
    return res
  })

  app.get(`/:${primaryKeyCamelcase}`, {
    schema: {
      operationId: `get${entity.name}By${capitalize(primaryKeyCamelcase)}`,
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
    },
    links: {
      200: entityLinks
    }
  }, async function (request, reply) {
    const ctx = { app: this, reply }
    const res = await entity.find({
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

  for (const method of ['POST', 'PUT']) {
    app.route({
      url: `/:${primaryKeyCamelcase}`,
      method,
      schema: {
        body: entitySchema,
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
      },
      links: {
        200: entityLinks
      },
      async handler (request, reply) {
        const id = request.params[primaryKeyCamelcase]
        const ctx = { app: this, reply }
        const res = await entity.save({
          ctx,
          input: {
            ...request.body,
            [primaryKeyCamelcase]: id
          },
          where: {
            [primaryKeyCamelcase]: {
              eq: id
            }
          },
          fields: request.query.fields
        })
        if (!res) {
          return reply.callNotFound()
        }
        reply.header('location', `${app.prefix}/${res[primaryKeyCamelcase]}`)
        return res
      }
    })
  }

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
}

function getPrimaryKeyParams (entity) {
  const primaryKey = entity.primaryKey
  const fields = entity.fields
  const field = fields[primaryKey]
  const properties = {
    [field.camelcase]: { type: mapSQLTypeToOpenAPIType(field.sqlType) }
  }
  const required = [field.camelcase]

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

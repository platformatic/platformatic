'use strict'

const { mapSQLTypeToOpenAPIType } = require('@platformatic/sql-json-schema-mapper')

function generateArgs (entity, ignore) {
  const sortedEntityFields = Object.keys(entity.fields).sort()

  const whereArgs = sortedEntityFields.reduce((acc, name) => {
    if (ignore[name]) {
      return acc
    }
    const field = entity.fields[name]
    const baseKey = `where.${field.camelcase}.`
    for (const modifier of ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like']) {
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
    if (ignore[name]) {
      return acc
    }
    const field = entity.fields[name]
    const key = `orderby.${field.camelcase}`
    acc[key] = { type: 'string', enum: ['asc', 'desc'] }
    return acc
  }, {})

  return { whereArgs, orderByArgs }
}

module.exports.generateArgs = generateArgs

function rootEntityRoutes (app, entity, whereArgs, orderByArgs, entityLinks, entitySchema, fields, ignoredRoutes) {
  if (!ignoredRoutes.GET?.includes(app.prefix + '/')) {
    app.get('/', {
      schema: {
        operationId: 'get' + capitalize(entity.pluralName),
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', description: 'Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown' },
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
        if ((((offset ?? 0) === 0) || (res.length > 0)) && ((limit !== undefined) && (res.length < limit))) {
          totalCount = (offset ?? 0) + res.length
        } else {
          totalCount = await entity.count({ where, ctx })
        }
        reply.header('X-Total-Count', totalCount)
      }

      return res
    })
  }

  if (!ignoredRoutes.POST?.includes(app.prefix + '/')) {
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
  }

  if (!ignoredRoutes.PUT?.includes(app.prefix + '/')) {
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
      links: {
        200: entityLinks
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
  }
}

module.exports.rootEntityRoutes = rootEntityRoutes

function capitalize (str) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

module.exports.capitalize = capitalize

function getFieldsForEntity (entity, ignore) {
  return {
    type: 'array',
    items: {
      type: 'string',
      enum: Object.keys(entity.fields)
        .map((field) => entity.fields[field].camelcase)
        .filter((field) => !ignore[field])
        .sort()
    }
  }
}

module.exports.getFieldsForEntity = getFieldsForEntity

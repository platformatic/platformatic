'use strict'

const { mapSQLTypeToOpenAPIType } = require('@platformatic/sql-json-schema-mapper')
const camelcase = require('camelcase')
const { singularize } = require('inflected')

const getEntityLinksForEntity = (app, entity) => {
  const entityLinks = {}
  for (const relation of entity.relations) {
    const ownField = camelcase(relation.column_name)
    const relatedEntity = app.platformatic.entities[camelcase(singularize(relation.foreign_table_name))]
    const relatedEntityPrimaryKeyCamelcase = camelcase(relatedEntity.primaryKey)
    const relatedEntityPrimaryKeyCamelcaseCapitalized = capitalize(relatedEntityPrimaryKeyCamelcase)
    const getEntityById = `Get${relatedEntity.name}By${relatedEntityPrimaryKeyCamelcaseCapitalized}`
    entityLinks[getEntityById] = {
      operationId: `get${relatedEntity.name}By${relatedEntityPrimaryKeyCamelcaseCapitalized}`,
      parameters: {
        [relatedEntityPrimaryKeyCamelcase]: `$response.body#/${ownField}`
      }
    }
  }

  for (const relationship of entity.reverseRelationships) {
    const relation = relationship.relation
    const theirField = camelcase(relation.column_name)
    const ownField = camelcase(relation.foreign_column_name)
    const relatedEntity = app.platformatic.entities[camelcase(singularize(relation.table_name))]
    const getEntities = `Get${capitalize(relatedEntity.pluralName)}`
    entityLinks[getEntities] = {
      operationId: `get${capitalize(relatedEntity.pluralName)}`,
      parameters: {
        [`where.${theirField}.eq`]: `$response.body#/${ownField}`
      }
    }
  }
  return entityLinks
}

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
  const primaryKeyParams = getPrimaryKeyParams(entity)
  const primaryKeyCamelcase = camelcase(entity.primaryKey)
  const entityLinks = getEntityLinksForEntity(app, entity)

  const sortedEntityFields = Object.keys(entity.fields).sort()

  const whereArgs = sortedEntityFields.reduce((acc, name) => {
    const field = entity.fields[name]
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

  const orderByArgs = sortedEntityFields.reduce((acc, name) => {
    const field = entity.fields[name]
    const key = `orderby.${field.camelcase}`
    acc[key] = { type: 'string', enum: ['asc', 'desc'] }
    return acc
  }, {})

  app.addHook('preValidation', async (req) => {
    if (typeof req.query.fields === 'string') {
      req.query.fields = req.query.fields.split(',')
    }
  })

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

  // For every reverse relationship we create: entity/:entity_Id/target_entity
  for (const reverseRelationship of entity.reverseRelationships) {
    const targetEntityName = singularize(camelcase(reverseRelationship.relation.table_name))
    const targetEntity = app.platformatic.entities[targetEntityName]
    const targetForeignKeyCamelcase = camelcase(reverseRelationship.relation.column_name)
    const targetEntitySchema = {
      $ref: targetEntity.name + '#'
    }
    const entityLinks = getEntityLinksForEntity(app, targetEntity)
    // e.g. getQuotesForMovie
    const operationId = `get${capitalize(targetEntity.pluralName)}For${capitalize(entity.singularName)}`
    app.get(`/:${camelcase(entity.primaryKey)}/${targetEntity.pluralName}`, {
      schema: {
        operationId,
        params: getPrimaryKeyParams(entity),
        querystring: {
          type: 'object',
          properties: {
            fields: getFieldsForEntity(targetEntity)
          }
        },
        response: {
          200: {
            type: 'array',
            items: targetEntitySchema
          }
        }
      },
      links: {
        200: entityLinks
      }
    }, async function (request, reply) {
      const ctx = { app: this, reply }
      // IF we want to have HTTP/404 in case the entity does not exist
      // we need to do 2 queries. One to check if the entity exists. the other to get the related entities
      // Improvement: this could be also done with a single query with a join,

      // check that the entity exists
      const resEntity = await entity.count({
        ctx,
        where: {
          [primaryKeyCamelcase]: {
            eq: request.params[primaryKeyCamelcase]
          }
        }
      })
      if (resEntity === 0) {
        return reply.callNotFound()
      }

      // get the related entities
      const res = await targetEntity.find({
        ctx,
        where: {
          [targetForeignKeyCamelcase]: {
            eq: request.params[primaryKeyCamelcase]
          }
        },
        fields: request.query.fields

      })
      if (res.length === 0) {
        // This is a query on a FK, so
        return []
      }
      return res
    })
  }

  // For every relationship we create: entity/:entity_Id/target_entity
  for (const relation of entity.relations) {
    const targetEntityName = singularize(camelcase(relation.foreign_table_name))
    const targetEntity = app.platformatic.entities[targetEntityName]
    const targetForeignKeyCamelcase = camelcase(relation.foreign_column_name)
    const targetColumnCamelcase = camelcase(relation.column_name)
    const targetRelation = relation.column_name.replace(/_id$/, '')
    const targetEntitySchema = {
      $ref: targetEntity.name + '#'
    }
    const entityLinks = getEntityLinksForEntity(app, targetEntity)
    // e.g. getMovieForQuote
    const operationId = `get${capitalize(targetEntity.singularName)}For${capitalize(entity.singularName)}`
    // We need to get the relation name from the PK column:
    app.get(`/:${camelcase(entity.primaryKey)}/${targetRelation}`, {
      schema: {
        operationId,
        params: getPrimaryKeyParams(entity),
        querystring: {
          type: 'object',
          properties: {
            fields: getFieldsForEntity(targetEntity)
          }
        },
        response: {
          200: targetEntitySchema
        }
      },
      links: {
        200: entityLinks
      }
    }, async function (request, reply) {
      const ctx = { app: this, reply }
      // check that the entity exists
      const resEntity = (await entity.find({
        ctx,
        where: {
          [primaryKeyCamelcase]: {
            eq: request.params[primaryKeyCamelcase]
          }
        }
      }))[0]

      if (!resEntity) {
        return reply.callNotFound()
      }

      // get the related entity
      const res = await targetEntity.find({
        ctx,
        where: {
          [targetForeignKeyCamelcase]: {
            eq: resEntity[targetColumnCamelcase]
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
        ctx
      })
      if (!res) {
        return reply.callNotFound()
      }
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

'use strict'

const { mapSQLTypeToOpenAPIType } = require('@platformatic/sql-json-schema-mapper')
const camelcase = require('camelcase')
const { singularize } = require('inflected')
const { generateArgs, rootEntityRoutes, capitalize, getFieldsForEntity } = require('./shared')

const getEntityLinksForEntity = (app, entity) => {
  const entityLinks = {}
  for (const relation of entity.relations) {
    const ownField = camelcase(relation.column_name)
    const relatedEntity = app.platformatic.entities[camelcase(singularize(relation.foreign_table_name))]
    const relatedEntityPrimaryKeyCamelcase = camelcase(relatedEntity.primaryKeys.values().next().value)
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
    if (relatedEntity.primaryKeys.size !== 1) {
      continue
    }
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

async function entityPlugin (app, opts) {
  const entity = opts.entity

  const entitySchema = {
    $ref: entity.name + '#'
  }
  const primaryKey = entity.primaryKeys.values().next().value
  const primaryKeyParams = getPrimaryKeyParams(entity)
  const primaryKeyCamelcase = camelcase(primaryKey)
  const entityLinks = getEntityLinksForEntity(app, entity)

  const { whereArgs, orderByArgs } = generateArgs(entity)

  app.addHook('preValidation', async (req) => {
    if (typeof req.query.fields === 'string') {
      req.query.fields = req.query.fields.split(',')
    }
  })

  const fields = getFieldsForEntity(entity)

  rootEntityRoutes(app, entity, whereArgs, orderByArgs, entityLinks, entitySchema, fields)

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
    app.get(`/:${camelcase(primaryKey)}/${targetEntity.pluralName}`, {
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
    app.get(`/:${camelcase(primaryKey)}/${targetRelation}`, {
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
  const primaryKey = entity.primaryKeys.values().next().value
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

module.exports = entityPlugin

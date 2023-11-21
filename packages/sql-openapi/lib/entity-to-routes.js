'use strict'

const { mapSQLTypeToOpenAPIType } = require('@platformatic/sql-json-schema-mapper')
const { findNearestString } = require('@platformatic/utils')
const camelcase = require('camelcase')
const { generateArgs, rootEntityRoutes, capitalize, getFieldsForEntity } = require('./shared')
const errors = require('./errors')

const getEntityLinksForEntity = (app, entity) => {
  const entityLinks = {}
  for (const relation of entity.relations) {
    const ownField = camelcase(relation.column_name)
    const relatedEntity = app.platformatic.entities[relation.foreignEntityName]
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
    const relatedEntity = app.platformatic.entities[relation.entityName]
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
  const ignore = opts.ignore

  const entitySchema = {
    $ref: entity.name + '#'
  }

  const entitySchemaInput = {
    $ref: entity.name + 'Input#'
  }

  const entityFieldsNames = Object.values(entity.fields)
    .map(field => field.camelcase)

  for (const ignoredField of Object.keys(ignore)) {
    if (!entityFieldsNames.includes(ignoredField)) {
      const nearestField = findNearestString(entityFieldsNames, ignoredField)
      app.log.warn(
        `Ignored openapi field "${ignoredField}" not found in entity "${entity.singularName}".` +
        ` Did you mean "${nearestField}"?`
      )
    }
  }

  const primaryKey = entity.primaryKeys.values().next().value
  const primaryKeyParams = getPrimaryKeyParams(entity, ignore)
  const primaryKeyCamelcase = camelcase(primaryKey)
  const entityLinks = getEntityLinksForEntity(app, entity)

  const { whereArgs, orderByArgs } = generateArgs(entity, ignore)

  app.addHook('preValidation', async (req) => {
    if (typeof req.query.fields === 'string') {
      req.query.fields = req.query.fields.split(',')
    }
  })

  const fields = getFieldsForEntity(entity, ignore)

  rootEntityRoutes(app, entity, whereArgs, orderByArgs, entityLinks, entitySchema, fields, entitySchemaInput)

  app.get(`/:${primaryKeyCamelcase}`, {
    schema: {
      operationId: `get${entity.name}By${capitalize(primaryKeyCamelcase)}`,
      summary: `Get ${entity.name} by ${primaryKeyCamelcase}.`,
      description: `Fetch ${entity.name} using its ${primaryKeyCamelcase} from the database.`,
      params: primaryKeyParams,
      tags: [entity.table],
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

  const mapRoutePathNamesReverseRelations = new Map()
  let idxRoutePathNamesReverseRelations = 1
  // For every reverse relationship we create: entity/:entity_Id/target_entity
  for (const reverseRelationship of entity.reverseRelationships) {
    const targetEntityName = reverseRelationship.relation.entityName
    const targetEntity = app.platformatic.entities[targetEntityName]
    const targetForeignKeyCamelcase = camelcase(reverseRelationship.relation.column_name)
    const targetEntitySchema = {
      $ref: targetEntity.name + '#'
    }
    const entityLinks = getEntityLinksForEntity(app, targetEntity)
    // e.g. getQuotesForMovie
    const operationId = `get${capitalize(targetEntity.pluralName)}For${capitalize(entity.singularName)}`

    let routePathName = targetEntity.relations.length > 1
      ? camelcase([reverseRelationship.sourceEntity, targetForeignKeyCamelcase])
      : targetEntity.pluralName

    if (mapRoutePathNamesReverseRelations.get(routePathName)) {
      idxRoutePathNamesReverseRelations++
      routePathName += idxRoutePathNamesReverseRelations
    } else {
      mapRoutePathNamesReverseRelations.set(routePathName, true)
    }

    try {
      app.get(`/:${camelcase(primaryKey)}/${routePathName}`, {
        schema: {
          operationId,
          summary: `Get ${targetEntity.pluralName} for ${entity.singularName}.`,
          description: `Fetch all the ${targetEntity.pluralName} for ${entity.singularName} from the database.`,
          params: getPrimaryKeyParams(entity, ignore),
          tags: [entity.table],
          querystring: {
            type: 'object',
            properties: {
              fields: getFieldsForEntity(targetEntity, ignore)
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
    } catch (error) /* istanbul ignore next */ {
      app.log.error(error)
      app.log.info({ routePathName, targetEntityName, targetEntitySchema, operationId })
      throw new errors.UnableToCreateTheRouteForTheReverseRelationshipError()
    }
  }

  const mapRoutePathNamesRelations = new Map()
  let idxRoutePathNamesRelations = 1
  // For every relationship we create: entity/:entity_Id/target_entity
  for (const relation of entity.relations) {
    const targetEntityName = relation.foreignEntityName
    const targetEntity = app.platformatic.entities[targetEntityName]
    const targetForeignKeyCamelcase = camelcase(relation.foreign_column_name)
    const targetColumnCamelcase = camelcase(relation.column_name)
    // In this case, we navigate the relationship so we MUST use the column_name otherwise we will fail in case of recursive relationships
    // (or multiple relationships between the same entities). We might want to specify this in documentation, because can be confusing
    let targetRelation = relation.column_name.replace(/_id$/, '')
    if (mapRoutePathNamesRelations.get(targetRelation)) {
      idxRoutePathNamesRelations++
      targetRelation += idxRoutePathNamesRelations
    } else {
      mapRoutePathNamesRelations.set(targetRelation, true)
    }

    const targetEntitySchema = {
      $ref: targetEntity.name + '#'
    }
    const entityLinks = getEntityLinksForEntity(app, targetEntity)
    // e.g. getMovieForQuote
    const operationId = `get${capitalize(targetEntity.singularName)}For${capitalize(entity.singularName)}`
    // We need to get the relation name from the PK column:
    try {
      app.get(`/:${camelcase(primaryKey)}/${targetRelation}`, {
        schema: {
          operationId,
          summary: `Get ${targetEntity.singularName} for ${entity.singularName}.`,
          description: `Fetch the ${targetEntity.singularName} for ${entity.singularName} from the database.`,
          params: getPrimaryKeyParams(entity, ignore),
          tags: [entity.table],
          querystring: {
            type: 'object',
            properties: {
              fields: getFieldsForEntity(targetEntity, ignore)
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
    } catch (error) /* istanbul ignore next */ {
      app.log.error(error)
      app.log.info({ primaryKey, targetRelation, targetEntitySchema, targetEntityName, targetEntity, operationId })
      throw new errors.UnableToCreateTheRouteForThePKColRelationshipError()
    }
  }

  app.route({
    url: `/:${primaryKeyCamelcase}`,
    method: 'PUT',
    schema: {
      operationId: 'update' + capitalize(entity.singularName),
      summary: `Update ${entity.singularName}.`,
      description: `Update ${entity.singularName} in the database.`,
      body: entitySchemaInput,
      params: primaryKeyParams,
      tags: [entity.table],
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

  app.delete(`/:${primaryKeyCamelcase}`, {
    schema: {
      operationId: 'delete' + capitalize(entity.pluralName),
      summary: `Delete ${entity.pluralName}.`,
      description: `Delete one or more ${entity.pluralName} from the Database.`,
      params: primaryKeyParams,
      tags: [entity.table],
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

function getPrimaryKeyParams (entity, ignore) {
  const primaryKey = entity.primaryKeys.values().next().value
  const fields = entity.fields
  const field = fields[primaryKey]
  const properties = {
    [field.camelcase]: { type: mapSQLTypeToOpenAPIType(field.sqlType, ignore) }
  }

  return {
    type: 'object',
    properties
  }
}

module.exports = entityPlugin

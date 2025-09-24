import { findNearestString } from '@platformatic/foundation'
import { mapSQLTypeToOpenAPIType } from '@platformatic/sql-json-schema-mapper'
import camelcase from 'camelcase'
import {
  UnableToCreateTheRouteForThePKColRelationshipError,
  UnableToCreateTheRouteForTheReverseRelationshipError
} from './errors.js'
import { capitalize, generateArgs, getFieldsForEntity, rootEntityRoutes } from './shared.js'

function getEntityLinksForEntity (app, entity) {
  const entityLinks = {}
  for (const relation of entity.relations) {
    const ownField = camelcase(relation.column_name)
    const relatedEntity = app.platformatic.entities[relation.foreignEntityName]
    if (!relatedEntity) {
      app.log.warn(`Entity "${entity.singularName}" has a foreign relation to unknown entity "${relation.foreignEntityName}". Skipped.`)
      continue
    }
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

export async function entityPlugin (app, opts) {
  const entity = opts.entity
  const ignore = opts.ignore
  const ignoreRoutes = opts.ignoreRoutes

  const entitySchema = {
    $ref: entity.name + '#'
  }

  const entitySchemaInput = {
    $ref: entity.name + 'Input#'
  }

  const entityFieldsNames = Object.values(entity.fields).map(field => field.camelcase)

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

  app.addHook('preValidation', async req => {
    if (typeof req.query.fields === 'string') {
      req.query.fields = req.query.fields.split(',')
    }
  })

  const fields = getFieldsForEntity(entity, ignore)

  rootEntityRoutes(
    app,
    entity,
    whereArgs,
    orderByArgs,
    entityLinks,
    entitySchema,
    fields,
    entitySchemaInput,
    ignoreRoutes
  )

  const openapiPath = `${app.prefix}/{${primaryKeyCamelcase}}`
  const ignoredGETRoute = ignoreRoutes.find(ignoreRoute => {
    return ignoreRoute.path === openapiPath && ignoreRoute.method === 'GET'
  })

  if (!ignoredGETRoute) {
    app.get(
      `/:${primaryKeyCamelcase}`,
      {
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
      },
      async function (request, reply) {
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
      }
    )
  }

  const mapRoutePathNamesReverseRelations = new Map()
  let idxRoutePathNamesReverseRelations = 1
  // For every reverse relationship we create: entity/:entity_Id/target_entity
  for (const reverseRelationship of entity.reverseRelationships) {
    const targetEntityName = reverseRelationship.relation.entityName
    const targetEntity = app.platformatic.entities[targetEntityName]
    if (!targetEntity) {
      app.log.warn(`Entity "${entity.singularName}" has a reverse relation to unknown entity "${targetEntityName}". Skipped.`)
      continue
    }
    const targetForeignKeyCamelcase = camelcase(reverseRelationship.relation.column_name)
    const targetEntitySchema = {
      $ref: targetEntity.name + '#'
    }
    const entityLinks = getEntityLinksForEntity(app, targetEntity)
    // e.g. getQuotesForMovie
    const operationId = `get${capitalize(targetEntity.pluralName)}For${capitalize(entity.singularName)}`

    let routePathName =
      targetEntity.relations.length > 1
        ? camelcase([reverseRelationship.sourceEntity, targetForeignKeyCamelcase])
        : targetEntity.pluralName

    if (mapRoutePathNamesReverseRelations.get(routePathName)) {
      idxRoutePathNamesReverseRelations++
      routePathName += idxRoutePathNamesReverseRelations
    } else {
      mapRoutePathNamesReverseRelations.set(routePathName, true)
    }

    const reverseOpenapiPath = `${app.prefix}/{${camelcase(primaryKey)}}/${routePathName}`
    const ignoredReversedGETRoute = ignoreRoutes.find(ignoreRoute => {
      return ignoreRoute.path === reverseOpenapiPath && ignoreRoute.method === 'GET'
    })

    if (!ignoredReversedGETRoute) {
      try {
        app.get(
          `/:${camelcase(primaryKey)}/${routePathName}`,
          {
            schema: {
              operationId,
              summary: `Get ${targetEntity.pluralName} for ${entity.singularName}.`,
              description: `Fetch all the ${targetEntity.pluralName} for ${entity.singularName} from the database.`,
              params: getPrimaryKeyParams(entity, ignore),
              tags: [entity.table],
              querystring: {
                type: 'object',
                properties: {
                  limit: {
                    type: 'integer',
                    description:
                      'Limit will be applied by default if not passed. If the provided value exceeds the maximum allowed value a validation error will be thrown'
                  },
                  offset: { type: 'integer' },
                  fields: getFieldsForEntity(targetEntity, ignore),
                  totalCount: { type: 'boolean', default: false }
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
          },
          async function (request, reply) {
            const { limit, offset, fields } = request.query
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

            const where = {
              [targetForeignKeyCamelcase]: {
                eq: request.params[primaryKeyCamelcase]
              }
            }

            // get the related entities
            const res = await targetEntity.find({
              ctx,
              where,
              fields,
              limit,
              offset
            })

            // X-Total-Count header
            if (request.query.totalCount) {
              let totalCount
              if (((offset ?? 0) === 0 || res.length > 0) && limit !== undefined && res.length < limit) {
                totalCount = (offset ?? 0) + res.length
              } else {
                totalCount = await targetEntity.count({ where, ctx })
              }
              reply.header('X-Total-Count', totalCount)
            }

            if (res.length === 0) {
              // This is a query on a FK, so
              return []
            }
            return res
          }
        )
      } catch (error) /* istanbul ignore next */ {
        app.log.error(error)
        app.log.info({ routePathName, targetEntityName, targetEntitySchema, operationId })
        throw new UnableToCreateTheRouteForTheReverseRelationshipError()
      }
    }
  }

  const mapRoutePathNamesRelations = new Map()
  let idxRoutePathNamesRelations = 1
  // For every relationship we create: entity/:entity_Id/target_entity
  for (const relation of entity.relations) {
    const targetEntityName = relation.foreignEntityName
    const targetEntity = app.platformatic.entities[targetEntityName]
    if (!targetEntity) {
      app.log.warn(`Entity "${entity.singularName}" has a foreign relation to unknown entity "${targetEntityName}". Skipped.`)
      continue
    }
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

    const targetOpenapiPath = `${app.prefix}/{${camelcase(primaryKey)}}/${targetRelation}`
    const ignoredReversedGETRoute = ignoreRoutes.find(ignoreRoute => {
      return ignoreRoute.path === targetOpenapiPath && ignoreRoute.method === 'GET'
    })

    if (!ignoredReversedGETRoute) {
      try {
        app.get(
          `/:${camelcase(primaryKey)}/${targetRelation}`,
          {
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
          },
          async function (request, reply) {
            const ctx = { app: this, reply }
            // check that the entity exists
            const resEntity = (
              await entity.find({
                ctx,
                where: {
                  [primaryKeyCamelcase]: {
                    eq: request.params[primaryKeyCamelcase]
                  }
                }
              })
            )[0]

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
          }
        )
      } catch (error) /* istanbul ignore next */ {
        app.log.error(error)
        app.log.info({ primaryKey, targetRelation, targetEntitySchema, targetEntityName, targetEntity, operationId })
        throw new UnableToCreateTheRouteForThePKColRelationshipError()
      }
    }
  }

  const ignoredPUTRoute = ignoreRoutes.find(ignoreRoute => {
    return ignoreRoute.path === openapiPath && ignoreRoute.method === 'PUT'
  })
  if (!ignoredPUTRoute) {
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
  }

  const ignoredDELETERoute = ignoreRoutes.find(ignoreRoute => {
    return ignoreRoute.path === openapiPath && ignoreRoute.method === 'DELETE'
  })
  if (!ignoredDELETERoute) {
    app.delete(
      `/:${primaryKeyCamelcase}`,
      {
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
      },
      async function (request, reply) {
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
      }
    )
  }
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

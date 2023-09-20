'use strict'

const Swagger = require('@fastify/swagger')
const SwaggerUI = require('@fastify/swagger-ui')
const deepmerge = require('@fastify/deepmerge')({ all: true })
const { mapSQLEntityToJSONSchema } = require('@platformatic/sql-json-schema-mapper')
const entityPlugin = require('./lib/entity-to-routes')
const manyToMany = require('./lib/many-to-many')
const fp = require('fastify-plugin')
const errors = require('./lib/errors')

async function setupOpenAPI (app, opts) {
  const prefix = opts.prefix || ''
  const openapiConfig = deepmerge({
    exposeRoute: true,
    info: {
      title: 'Platformatic DB',
      description: 'Exposing a SQL database as REST',
      version: '1.0.0'
    }
  }, opts)
  app.log.trace({ openapi: openapiConfig })
  await app.register(Swagger, {
    exposeRoute: openapiConfig.exposeRoute,
    openapi: {
      ...openapiConfig
    },
    refResolver: {
      buildLocalReference (json, baseUri, fragment, i) {
        // TODO figure out if we need def-${i}
        /* istanbul ignore next */
        return json.$id || `def-${i}`
      }
    }
  })

  const ignore = opts.ignore || []

  const { default: theme } = await import('@platformatic/swagger-ui-theme')
  app.register(SwaggerUI, {
    ...theme,
    ...opts,
    logLevel: 'warn',
    prefix: '/documentation'
  })

  for (const entity of Object.values(app.platformatic.entities)) {
    const entitySchema = mapSQLEntityToJSONSchema(entity, ignore[entity.pluralName], true)
    // TODO remove reverseRelationships from the entity
    /* istanbul ignore next */
    entity.reverseRelationships = entity.reverseRelationships || []

    app.addSchema(entitySchema)

    const inputEntity = mapSQLEntityToJSONSchema(entity, ignore[entity.pluralName], false)
    inputEntity.$id = `${entitySchema.$id}Input`
    inputEntity.title = `${entitySchema.title}Input`

    app.addSchema(inputEntity)

    for (const relation of Object.values(entity.relations)) {
      const targetEntityName = relation.foreignEntityName
      const targetEntity = app.platformatic.entities[targetEntityName]
      const reverseRelationship = {
        sourceEntity: relation.entityName,
        relation
      }
      /* istanbul ignore next */
      targetEntity.reverseRelationships = targetEntity.reverseRelationships || []
      targetEntity.reverseRelationships.push(reverseRelationship)
    }
  }

  for (const entity of Object.values(app.platformatic.entities)) {
    if (ignore[entity.pluralName] === true) {
      continue
    }
    const localPrefix = `${prefix}/${entity.pluralName}`
    // TODO support ignore
    if (entity.primaryKeys.size === 1) {
      app.register(entityPlugin, {
        entity,
        prefix: localPrefix,
        ignore: ignore[entity.pluralName] || {}
      })
    } else {
      // TODO support ignore
      app.register(manyToMany, {
        entity,
        prefix: localPrefix,
        ignore
      })
    }
  }
}

module.exports = fp(setupOpenAPI)
module.exports.errors = errors

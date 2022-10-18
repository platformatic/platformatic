'use strict'

const Swagger = require('@fastify/swagger')
const SwaggerUI = require('@fastify/swagger-ui')
const deepmerge = require('@fastify/deepmerge')({ all: true })
const camelcase = require('camelcase')
const { singularize } = require('inflected')
const { mapSQLEntityToJSONSchema } = require('@platformatic/sql-json-schema-mapper')
const entityPlugin = require('./lib/entity-to-routes')
const fp = require('fastify-plugin')
const { version } = require('./package.json')

async function setupOpenAPI (app, opts) {
  const prefix = opts.prefix || ''
  const openapiConfig = deepmerge({
    exposeRoute: true,
    info: {
      title: 'Platformatic DB',
      description: 'Exposing a SQL database as REST',
      version
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

  app.register(SwaggerUI, opts)

  for (const entity of Object.values(app.platformatic.entities)) {
    const entitySchema = mapSQLEntityToJSONSchema(entity)
    // TODO remove reverseRelationships from the entity
    /* istanbul ignore next */
    entity.reverseRelationships = entity.reverseRelationships || []

    app.addSchema(entitySchema)

    for (const relation of Object.values(entity.relations)) {
      const targetEntityName = singularize(camelcase(relation.foreign_table_name))
      const targetEntity = app.platformatic.entities[targetEntityName]
      const reverseRelationship = {
        sourceEntity: entity.name,
        relation
      }
      /* istanbul ignore next */
      targetEntity.reverseRelationships = targetEntity.reverseRelationships || []
      targetEntity.reverseRelationships.push(reverseRelationship)
    }
  }

  for (const entity of Object.values(app.platformatic.entities)) {
    // TODO support ignore
    app.register(entityPlugin, {
      entity,
      prefix: `${prefix}/${entity.pluralName}`
    })
  }
}

module.exports = fp(setupOpenAPI)

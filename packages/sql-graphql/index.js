import { mercuriusFederationPlugin } from '@mercuriusjs/federation'
import { findNearestString } from '@platformatic/foundation'
import fp from 'fastify-plugin'
import { GraphQLObjectType, GraphQLSchema, GraphQLString, printSchema } from 'graphql'
import { GraphQLDate, GraphQLDateTime } from 'graphql-scalars'
import mercurius from 'mercurius'
import { constructGraph } from './lib/entity-to-type.js'
import { ErrorPrintingGraphQLSchema } from './lib/errors.js'
import { establishRelations } from './lib/relationship.js'
import { setupSubscriptions } from './lib/subscriptions.js'
import { setupTelemetry } from './lib/telemetry.js'

async function mapperToGraphql (app, opts) {
  const mapper = app.platformatic
  const queryTopFields = {}
  const mutationTopFields = {}
  const resolvers = {}
  const loaders = {}
  const federationReplacements = []
  const relations = []
  const ignore = opts.ignore || {}

  const graphOpts = {
    queryTopFields,
    mutationTopFields,
    resolvers,
    loaders,
    federationReplacements,
    federationMetadata: opts.federationMetadata
  }
  const metaMap = new Map()

  if (Object.keys(mapper.entities).length === 0) {
    // no schema
    queryTopFields.hello = { type: GraphQLString }
    resolvers.Query = {
      hello: () => 'Hello Platformatic!'
    }
  } else {
    const entitiesNames = Object.values(mapper.entities).map(entity => entity.singularName)

    for (const ignoredEntity of Object.keys(ignore)) {
      if (!entitiesNames.includes(ignoredEntity)) {
        const nearestEntity = findNearestString(entitiesNames, ignoredEntity)
        let warningMessage = `Ignored graphql entity "${ignoredEntity}" not found.`
        /* istanbul ignore next */
        if (nearestEntity) {
          warningMessage += ` Did you mean "${nearestEntity}"?`
        }
        app.log.warn(warningMessage)
      }
    }

    for (const entity of Object.values(mapper.entities)) {
      if (ignore[entity.singularName] === true) {
        continue
      }
      relations.push(...entity.relations)
      const meta = constructGraph(app, entity, graphOpts, ignore[entity.singularName] || {})
      metaMap.set(entity, meta)
    }

    establishRelations(app, relations, resolvers, loaders, queryTopFields, opts.resolvers || {}, metaMap)

    if (opts.resolvers) {
      for (const key of Object.keys(opts.resolvers)) {
        if (!resolvers[key]) {
          resolvers[key] = {}
        }

        const type = opts.resolvers[key]
        for (const resolver of Object.keys(type)) {
          if (type[resolver] === false) {
            if (resolvers[key][resolver]) {
              delete resolvers[key][resolver]
            }
            if (loaders[key]) {
              delete loaders[key][resolver]
            }
            /* istanbul ignore else */
            if (key === 'Mutation') {
              delete mutationTopFields[resolver]
            } else if (key === 'Query') {
              delete queryTopFields[resolver]
            }
          } else {
            resolvers[key][resolver] = type[resolver]
          }
        }
      }
    }
  }

  const query = new GraphQLObjectType({
    name: 'Query',
    fields: queryTopFields
  })

  const mutation =
    Object.keys(mutationTopFields).length > 0
      ? new GraphQLObjectType({
        name: 'Mutation',
        fields: mutationTopFields
      })
      : null

  if (!mutation) {
    delete resolvers.Mutation
  }

  let subscription
  if (app.platformatic.mq) {
    // Create a copy because we will alter it
    const ignoreList = Array.from(opts.subscriptionIgnore || [])

    const entitiesList = []

    for (const entity of Object.values(app.platformatic.entities)) {
      if (ignoreList.includes(entity.singularName)) {
        continue
      }
      // We currently do not support subscriptions for join tables
      if (entity.primaryKeys.size > 1) {
        continue
      }
      entitiesList.push(entity)
    }

    if (entitiesList.length > 0) {
      opts.subscription = {
        emitter: app.platformatic.mq
      }
      // TODO support ignoring some of those
      subscription = setupSubscriptions(app, metaMap, resolvers, ignoreList)
    }
  }

  let sdl = ''
  try {
    sdl = printSchema(new GraphQLSchema({ query, mutation, subscription }))
  } catch (error) {
    // The next lines are excluded from test coverage:
    // it's quite hard to test the following lines for all of the DB types
    /* istanbul ignore next */
    app.log.debug({ query, mutation, subscription }, 'GraphQL input schema')
    /* istanbul ignore next */
    const newError = new ErrorPrintingGraphQLSchema()
    /* istanbul ignore next */
    newError.cause = error
    /* istanbul ignore next */
    throw newError
  }

  if (opts.federationMetadata) {
    for (const replacement of federationReplacements) {
      sdl = sdl.replace(replacement.find, replacement.replace)
    }
    sdl = sdl.replace('type Query', 'type Query @extends')
  }

  if (opts.schema) {
    sdl += '\n'
    sdl += opts.schema
  }
  // Ignoriring because SQLite doesn't support dates
  /* istanbul ignore next */
  if (sdl.match(/scalar Date\n/)) {
    resolvers.Date = GraphQLDate
  }
  if (sdl.indexOf('scalar DateTime') >= 0) {
    resolvers.DateTime = GraphQLDateTime
  }

  opts.graphiql = opts.graphiql !== false

  let plugin = mercurius
  if (opts.federationMetadata) {
    plugin = mercuriusFederationPlugin
  }

  await app.register(plugin, {
    ...opts,
    schema: sdl,
    loaders,
    resolvers
  })

  if (app.openTelemetry) {
    setupTelemetry(app)
  }

  app.log.debug({ schema: sdl }, 'computed schema')
}

export default fp(mapperToGraphql)
export * as errors from './lib/errors.js'

'use strict'

const fp = require('fastify-plugin')
const constructGraph = require('./lib/entity-to-type')
const mercurius = require('mercurius')
const graphql = require('graphql')
const establishRelations = require('./lib/relationship')
const setupSubscriptions = require('./lib/subscriptions')
const scalars = require('graphql-scalars')

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
    queryTopFields.hello = { type: graphql.GraphQLString }
    resolvers.Query = {
      hello: () => 'Hello Platformatic!'
    }
  } else {
    for (const entity of Object.values(mapper.entities)) {
      if (ignore[entity.pluralName] === true) {
        continue
      }
      relations.push(...entity.relations)
      const meta = constructGraph(app, entity, graphOpts, ignore[entity.pluralName] || {})
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

  const query = new graphql.GraphQLObjectType({
    name: 'Query',
    fields: queryTopFields
  })

  const mutation = Object.keys(mutationTopFields).length > 0
    ? new graphql.GraphQLObjectType({
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
    sdl = graphql.printSchema(new graphql.GraphQLSchema({ query, mutation, subscription }))
  } catch (error) {
    // The next lines are excluded from test coverage:
    // it's quite hard to test the following lines for all of the DB types
    /* istanbul ignore next */
    app.log.debug({ query, mutation, subscription }, 'GraphQL input schema')
    /* istanbul ignore next */
    const newError = new Error('Error printing the GraphQL schema')
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
    resolvers.Date = scalars.GraphQLDate
  }
  if (sdl.indexOf('scalar DateTime') >= 0) {
    resolvers.DateTime = scalars.GraphQLDateTime
  }

  opts.graphiql = opts.graphiql !== false

  await app.register(mercurius, {
    ...opts,
    schema: sdl,
    loaders,
    resolvers
  })

  app.log.debug({ schema: sdl }, 'computed schema')
}

module.exports = fp(mapperToGraphql)

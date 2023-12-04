'use strict'

const { compose } = require('@platformatic/graphql-composer')

function createSupergraph ({ sdl = null, resolvers = {} } = {}) {
  return { sdl, resolvers }
}

function isSameGraphqlSchema (a, b) {
  // TODO review
  return a?.sdl === b?.sdl
}

function serviceToSubgraphConfig (service) {
  if (!service.graphql) { return }
  return {
    name: service.graphql.name || service.id || service.origin,
    entities: service.graphql.entities,
    server: {
      host: service.graphql.host || service.origin,
      composeEndpoint: service.graphql.composeEndpoint,
      graphqlEndpoint: service.graphql.graphqlEndpoint
    }
  }
}

async function fetchGraphqlSubgraphs (services, options, app) {
  const subgraphs = services.map(serviceToSubgraphConfig).filter(s => !!s)
  const composer = await compose({ ...toComposerOptions(options, app), subgraphs })

  return createSupergraph({
    sdl: composer.toSdl(),
    resolvers: composer.resolvers
  })
}

// TODO support subscriptions
// const defaultSubscriptionsOptions = {
//   onError: function onComposerSubscriptionsError (ctx, topic, err) {
//     // TODO log.error({err})
//     throw err
//   },
//   publish (ctx, topic, payload) {
//     ctx.pubsub.publish({ topic, payload })
//   },
//   subscribe (ctx, topic) {
//     return ctx.pubsub.subscribe(topic)
//   },
//   unsubscribe (ctx, topic) {
//     ctx.pubsub.close()
//   }
// }

function toComposerOptions (options, app) {
  return {
    // TODO logger: options?.logger
    defaultArgsAdapter: options?.defaultArgsAdapter,
    addEntitiesResolvers: options?.addEntitiesResolvers,
    onSubgraphError: (err) => {
      app.log.error({ err }, 'graphql composer error on subgraph')

      if (options?.onSubgraphError) {
        try {
          options.onSubgraphError(err)
        } catch (err) {
          app.log.error({ err }, 'running onSubgraphError')
        }
      }
    },
    // TODO options?.subscriptions ? defaultSubscriptionsOptions : undefined
    subscriptions: false // subscriptions are not supported yet
  }
}

module.exports = { fetchGraphqlSubgraphs, createSupergraph, isSameGraphqlSchema, serviceToSubgraphConfig }

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
    name: service.graphql.name || service.origin,
    entities: service.graphql.entities,
    server: {
      host: service.graphql.host || service.origin,
      composeEndpoint: service.graphql.composeEndpoint,
      graphqlEndpoint: service.graphql.graphqlEndpoint
    }
  }
}

async function fetchGraphqlSubgraphs (services, options) {
  const subgraphs = services.map(serviceToSubgraphConfig).filter(s => !!s)
  const composer = await compose({ ...toComposerOptions(options), subgraphs })

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

function toComposerOptions (options) {
  return {
    defaultArgsAdapter: options?.defaultArgsAdapter,
    subscriptions: false // subscriptions are not supported yet
    // TODO options?.subscriptions ? defaultSubscriptionsOptions : undefined
  }
}

module.exports = { fetchGraphqlSubgraphs, createSupergraph, isSameGraphqlSchema, serviceToSubgraphConfig }

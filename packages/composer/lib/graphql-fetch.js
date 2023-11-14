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
  if (!service?.graphql) { return }

  console.log(service)

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
    // TODO subscription
  })
}

function toComposerOptions (options) {
  return {
    defaultArgsAdapter: options?.defaultArgsAdapter
  }
}

module.exports = { fetchGraphqlSubgraphs, createSupergraph, isSameGraphqlSchema, serviceToSubgraphConfig }

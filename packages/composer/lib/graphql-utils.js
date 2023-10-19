'use strict'

function createSupergraph ({ sdl = null, schema = {}, resolvers = {} } = {}) {
  return { sdl, schema, resolvers }
}

function isSameGraphqlSchema (a, b) {
  return a?.sdl === b?.sdl
}

function serviceToSubgraphConfig (service) {
  if (!(service.graphql && !service.graphql.file)) { return }
  return {
    server: {
      host: service.graphql.url || service.origin,
      composeEndpoint: service.graphql.composeEndpoint,
      graphqlEndpoint: service.graphql.graphqlEndpoint
    }
  }
}

module.exports = { createSupergraph, isSameGraphqlSchema, serviceToSubgraphConfig }

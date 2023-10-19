'use strict'

const fp = require('fastify-plugin')
const mercurius = require('mercurius')

async function composeGraphql (app, opts) {
  if (!opts.services.some(s => s.graphql)) { return }

  const { fetchGraphqlSubgraphs } = await import('./graphql-fetch-subgraphs.mjs')
  // TODO see openapi

  const fromServices = []
  const fromFiles = []

  for (const service of opts.services) {
    if (!service.graphql) { continue }
    if (service.graphql.file) {
      fromFiles.push(service)
    } else {
      fromServices.push(service)
    }
  }

  const graphqlConfig = {
    graphiql: opts.graphql?.graphiql
  }
  if (fromServices.length > 0) {
    try {
      const graphqlSupergraph = await fetchGraphqlSubgraphs(fromServices)
      graphqlConfig.schema = graphqlSupergraph.sdl
      graphqlConfig.resolvers = graphqlSupergraph.resolvers
      app.graphqlSupergraph = graphqlSupergraph
    } catch (err) {
      // TODO spy test
      app.log.error({ err }, 'failed to fetch graphql services from origin')
    }
  }

  await app.register(mercurius, graphqlConfig)

  for (const service of fromFiles) {
    // TODO dataloaders? subscriptions?
    const { schema, resolvers } = require(service.graphql.file)

    // TODO documentation, test
    try {
      if (schema) {
        app.graphql.extendSchema(schema)
      }
      if (resolvers) {
        app.graphql.defineResolvers(resolvers)
      }
    } catch (err) {
      // TODO spy test
      app.log.error({ err }, 'failed to load graphql services from file')
    }
  }

  // TODO see openapi
}

module.exports = fp(composeGraphql)

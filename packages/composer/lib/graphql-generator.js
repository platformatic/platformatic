'use strict'

const fp = require('fastify-plugin')
const mercurius = require('mercurius')
const { fetchGraphqlSubgraphs } = require('./graphql-fetch')

async function composeGraphql (app, opts) {
  if (!opts.services.some(s => s.graphql)) { return }

  const services = []

  for (const service of opts.services) {
    if (!service.graphql) { continue }
    services.push(service)
  }

  const graphqlConfig = {
    graphiql: opts.graphql?.graphiql
  }
  if (services.length > 0) {
    try {
      const graphqlSupergraph = await fetchGraphqlSubgraphs(services, opts.graphql)
      graphqlConfig.schema = graphqlSupergraph.sdl
      graphqlConfig.resolvers = graphqlSupergraph.resolvers
      app.graphqlSupergraph = graphqlSupergraph
    } catch (err) {
      // TODO spy test
      app.log.error({ err }, 'failed to fetch graphql services from origin')
    }
  }

  await app.register(mercurius, graphqlConfig)
}

module.exports = fp(composeGraphql)

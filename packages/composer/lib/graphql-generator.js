import fp from 'fastify-plugin'
import mercurius from 'mercurius'
import { fetchGraphqlSubgraphs } from './graphql-fetch.js'

async function graphqlGeneratorPlugin (app, opts) {
  if (!opts.services.some(s => s.graphql)) {
    return
  }

  const services = []

  for (const service of opts.services) {
    if (!service.graphql) {
      continue
    }
    services.push(service)
  }

  const graphqlConfig = {
    graphiql: opts.graphql?.graphiql
  }
  if (services.length > 0) {
    const graphqlSupergraph = await fetchGraphqlSubgraphs(services, opts.graphql, app)
    graphqlConfig.schema = graphqlSupergraph.sdl
    graphqlConfig.resolvers = graphqlSupergraph.resolvers
    graphqlConfig.subscription = false // TODO support subscriptions, will be !!opts.graphql.subscriptions
    app.graphqlSupergraph = graphqlSupergraph
  }

  await app.register(mercurius, graphqlConfig)
}

export const graphqlGenerator = fp(graphqlGeneratorPlugin)

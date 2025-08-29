import fp from 'fastify-plugin'
import mercurius from 'mercurius'
import { fetchGraphqlSubgraphs } from './graphql-fetch.js'

async function graphqlGeneratorPlugin (app, opts) {
  if (!opts.applications.some(s => s.graphql)) {
    return
  }

  const applications = []

  for (const application of opts.applications) {
    if (!application.graphql) {
      continue
    }
    applications.push(application)
  }

  const graphqlConfig = {
    graphiql: opts.graphql?.graphiql
  }
  if (applications.length > 0) {
    const graphqlSupergraph = await fetchGraphqlSubgraphs(applications, opts.graphql, app)
    graphqlConfig.schema = graphqlSupergraph.sdl
    graphqlConfig.resolvers = graphqlSupergraph.resolvers
    graphqlConfig.subscription = false // TODO support subscriptions, will be !!opts.graphql.subscriptions
    app.graphqlSupergraph = graphqlSupergraph
  }

  await app.register(mercurius, graphqlConfig)
}

export const graphqlGenerator = fp(graphqlGeneratorPlugin)

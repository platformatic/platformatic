import fp from 'fastify-plugin'
import { createSupergraph } from './graphql-fetch.js'

const graphqlSupergraphSymbol = Symbol('graphqlSupergraph')

export async function graphqlPlugin (app, opts) {
  app.decorate('graphqlSupergraph', {
    getter () {
      return this[graphqlSupergraphSymbol]
    },
    setter (v) {
      this[graphqlSupergraphSymbol] = v
    }
  })
  app.decorate('graphqlGatewayOptions', {
    getter () {
      return opts
    }
  })
  app.decorate('graphqlComposerOptions', {
    getter () {
      return opts
    }
  })

  app.graphqlSupergraph = createSupergraph()
}

export const graphql = fp(graphqlPlugin)

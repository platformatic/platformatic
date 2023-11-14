'use strict'

const fp = require('fastify-plugin')
const { createSupergraph } = require('./graphql-fetch')

const graphqlSupergraphSymbol = Symbol('graphqlSupergraph')

async function composeGraphql (app, opts) {
  app.decorate('graphqlSupergraph', {
    getter () { return this[graphqlSupergraphSymbol] },
    setter (v) { this[graphqlSupergraphSymbol] = v }
  })
  app.decorate('graphqlComposerOptions', {
    getter () { return opts }
  })

  app.graphqlSupergraph = createSupergraph()
}

module.exports = fp(composeGraphql)

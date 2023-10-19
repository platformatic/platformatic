'use strict'

const fp = require('fastify-plugin')
const { createSupergraph } = require('./graphql-utils')

async function composeGraphql (app, opts) {
  app.decorate('graphqlSupergraph', {
    getter () { return this.v },
    setter (v) { this.v = v }
  })

  app.graphqlSupergraph = createSupergraph()
}

module.exports = fp(composeGraphql)

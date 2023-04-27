'use strict'

const mercurius = require('mercurius')
const deepmerge = require('@fastify/deepmerge')({ all: true })
const fp = require('fastify-plugin')

// For some unknown reason, c8 is not detecting any of this
// despite being covered by test/graphql.test.js
/* c8 ignore next 12 */
async function setupGraphQL (app, opts) {
  if (typeof opts !== 'object') {
    opts = {}
  }
  const graphqlOptions = deepmerge({
    graphiql: true
  }, opts)

  app.register(mercurius, graphqlOptions)
}

module.exports = fp(setupGraphQL)

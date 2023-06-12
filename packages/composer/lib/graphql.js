'use strict'

const mercuriusGateway = require('@mercuriusjs/gateway')
const fp = require('fastify-plugin')

const graphiql = require('./graphiql.js')

// For some unknown reason, c8 is not detecting any of this
// despite being covered by test/graphql.test.js
/* c8 ignore next 12 */
async function setupGraphQL (app, opts) {
  const services = []
  for (const { id, origin, graphql } of opts.services) {
    if (!graphql) continue

    const graphqlUrl = origin + graphql.url
    services.push({ name: id, url: graphqlUrl })
  }

  if (services.length === 0) return

  app.register(mercuriusGateway, {
    gateway: { services }
  })
  app.register(graphiql)
}

module.exports = fp(setupGraphQL)

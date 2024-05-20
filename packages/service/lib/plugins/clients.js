'use strict'

const fp = require('fastify-plugin')
const client = require('@platformatic/client')

async function setupClients (app, opts) {
  for (const { path, url, serviceId, name, schema, type } of opts) {
    if (path) {
      app.register(require(path), { url, serviceId })
    } else {
      app.register(client, { url, serviceId, name, path: schema, type })
    }
  }
}

module.exports = fp(setupClients)

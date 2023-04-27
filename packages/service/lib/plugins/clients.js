'use strict'

const fp = require('fastify-plugin')

async function setupClients (app, opts) {
  const clientsConfig = opts
  for (const { path, url } of clientsConfig) {
    app.register(require(path), { url })
  }
}

module.exports = fp(setupClients)

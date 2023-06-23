'use strict'

const fp = require('fastify-plugin')

async function setupClients (app, opts) {
  for (const { path, url, serviceId } of opts) {
    app.register(require(path), { url, serviceId })
  }
}

module.exports = fp(setupClients)

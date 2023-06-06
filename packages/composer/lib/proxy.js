'use strict'

const fp = require('fastify-plugin')
const httpProxy = require('@fastify/http-proxy')

module.exports = fp(async function (app, opts) {
  for (const { id, origin } of opts.services) {
    const prefix = opts.proxy.prefix + '/' + id
    app.log.info(`Proxying ${prefix} to ${origin}`)

    app.register(httpProxy, {
      prefix,
      upstream: origin,
      websocket: true
    })
  }
}, {
  name: 'service-proxy'
})

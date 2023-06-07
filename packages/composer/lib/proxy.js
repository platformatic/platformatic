'use strict'

const { getGlobalDispatcher } = require('undici')
const httpProxy = require('@fastify/http-proxy')
const fp = require('fastify-plugin')

module.exports = fp(async function (app, opts) {
  for (const { proxy, origin } of opts.services) {
    if (!proxy) continue

    const prefix = proxy.prefix
    app.log.info(`Proxying ${prefix} to ${origin}`)

    const dispatcher = getGlobalDispatcher()

    await app.register(httpProxy, {
      prefix,
      upstream: origin,
      websocket: true,
      undici: dispatcher,
      destroyAgent: false
    })
  }
})

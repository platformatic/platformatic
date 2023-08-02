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
      destroyAgent: false,
      replyOptions: {
        rewriteRequestHeaders: (request, headers) => {
          const targetUrl = `${origin}${request.url}`
          const context = request.span?.context
          const { span, telemetryHeaders } = app.openTelemetry?.startSpanClient(targetUrl, request.method, context) || { span: null, telemetryHeaders: {} }
          // We need to store the span in a different object
          // to correctly close it in the onResponse hook
          // Note that we have 2 spans:
          // - request.span: the span of the request to the proxy
          // - request.proxedCallSpan: the span of the request to the proxied service
          request.proxedCallSpan = span
          return {
            ...telemetryHeaders,
            ...headers
          }
        },
        onResponse: (request, reply, res) => {
          app.openTelemetry?.endSpanClient(reply.request.proxedCallSpan, { statusCode: reply.statusCode })
          reply.send(res)
        }
      }
    })
  }
})

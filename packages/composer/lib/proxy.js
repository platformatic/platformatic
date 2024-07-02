'use strict'

const { getGlobalDispatcher } = require('undici')
const httpProxy = require('@fastify/http-proxy')
const fp = require('fastify-plugin')
const { metaKeys } = require('@platformatic/config')

module.exports = fp(async function (app, opts) {
  const config = app.platformatic.config

  for (const service of opts.services) {
    if (!service.proxy) {
      continue
    }

    const { id, origin, proxy } = service
    const upstream = app.platformatic.meta?.[id]?.[metaKeys.accessPoint] ?? origin
    const prefix = proxy.prefix.at(-1) === '/'
      ? proxy.prefix.slice(0, -1)
      : proxy.prefix

    app.log.info(`Proxying ${prefix.length ? prefix : '/'} to ${upstream}`)

    const dispatcher = getGlobalDispatcher()

    await app.register(httpProxy, {
      prefix,
      upstream,
      websocket: true,
      undici: dispatcher,
      destroyAgent: false,
      replyOptions: {
        rewriteRequestHeaders: (request, headers) => {
          const targetUrl = `${upstream}${request.url}`
          const context = request.span?.context
          const { span, telemetryHeaders } =
            app.openTelemetry?.startSpanClient(targetUrl, request.method, context) ||
            { span: null, telemetryHeaders: {} }

          // We need to store the span in a different object
          // to correctly close it in the onResponse hook
          // Note that we have 2 spans:
          // - request.span: the span of the request to the proxy
          // - request.proxedCallSpan: the span of the request to the proxied service
          request.proxedCallSpan = span

          headers = {
            ...headers,
            ...telemetryHeaders,
            'x-forwarded-for': request.ip,
            'x-forwarded-host': request.hostname
          }

          const telemetryId = config.telemetry?.serviceName
          if (telemetryId) {
            headers['x-telemetry-id'] = telemetryId
          }

          return headers
        },
        onResponse: (request, reply, res) => {
          app.openTelemetry?.endSpanClient(reply.request.proxedCallSpan, { statusCode: reply.statusCode })
          reply.send(res)
        }
      }
    })
  }
})

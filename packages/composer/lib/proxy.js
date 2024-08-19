'use strict'

const { getGlobalDispatcher } = require('undici')
const httpProxy = require('@fastify/http-proxy')
const fp = require('fastify-plugin')

const kITC = Symbol.for('plt.runtime.itc')

async function resolveServiceProxyParameters (service) {
  let {
    origin,
    proxy: { prefix },
  } = service

  if (prefix.endsWith('/')) {
    prefix = prefix.slice(0, -1)
  }

  let rewritePrefix = ''
  let internalRewriteLocationHeader = true

  // Get meta information from the service, if any, to eventually hook up to a TCP port
  const meta = (await globalThis[kITC]?.send('getServiceMeta', service.id))?.composer ?? {}

  if (meta.tcp) {
    origin = meta.url
  }

  if (meta.prefix) {
    prefix = meta.prefix
  }

  if (meta.wantsAbsoluteUrls) {
    rewritePrefix = prefix
    internalRewriteLocationHeader = false
  }

  return { origin, prefix, rewritePrefix, internalRewriteLocationHeader }
}

module.exports = fp(async function (app, opts) {
  for (const service of opts.services) {
    if (!service.proxy) {
      // When a service defines no expose config at all
      // we assume a proxy exposed with a prefix equals to its id
      if (service.proxy !== false && !service.openapi && !service.graphql) {
        service.proxy = { prefix: service.id }
      } else {
        continue
      }
    }

    const { prefix, origin, rewritePrefix, internalRewriteLocationHeader } =
      await resolveServiceProxyParameters(service)

    app.log.info(`Proxying ${prefix} to ${origin}`)

    const dispatcher = getGlobalDispatcher()

    await app.register(httpProxy, {
      prefix,
      rewritePrefix,
      upstream: origin,
      websocket: true,
      undici: dispatcher,
      destroyAgent: false,
      internalRewriteLocationHeader,
      replyOptions: {
        rewriteRequestHeaders: (request, headers) => {
          const targetUrl = `${origin}${request.url}`
          const context = request.span?.context
          const { span, telemetryHeaders } = app.openTelemetry?.startHTTPSpanClient(
            targetUrl,
            request.method,
            context
          ) || { span: null, telemetryHeaders: {} }
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
            'x-forwarded-host': request.hostname,
          }

          return headers
        },
        onResponse: (request, reply, res) => {
          app.openTelemetry?.endHTTPSpanClient(reply.request.proxedCallSpan, { statusCode: reply.statusCode })
          reply.send(res)
        },
      },
    })
  }
})

'use strict'

const { getGlobalDispatcher } = require('undici')
const httpProxy = require('@fastify/http-proxy')
const fp = require('fastify-plugin')

const kITC = Symbol.for('plt.runtime.itc')

async function resolveServiceProxyParameters (service) {
  let {
    origin,
    proxy: { prefix }
  } = service

  if (prefix.endsWith('/')) {
    prefix = prefix.slice(0, -1)
  }

  let rewritePrefix = ''
  let internalRewriteLocationHeader = true

  // Get meta information from the service, if any, to eventually hook up to a TCP port
  console.time('proxy ' + service.id)
  const meta = (await globalThis[kITC]?.send('getServiceMeta', service.id))?.composer ?? {}
  console.timeEnd('proxy ' + service.id)

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

  return { origin, prefix, rewritePrefix, internalRewriteLocationHeader, needsRootRedirect: meta.needsRootRedirect }
}

module.exports = fp(async function (app, opts) {
  const meta = { proxies: {} }

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

    const parameters = await resolveServiceProxyParameters(service)
    const { prefix, origin, rewritePrefix, internalRewriteLocationHeader, needsRootRedirect } = parameters
    meta.proxies[service.id] = parameters

    const basePath = `/${prefix ?? ''}`.replaceAll(/\/+/g, '/').replace(/\/$/, '')
    const dispatcher = getGlobalDispatcher()

    if (needsRootRedirect) {
      app.addHook('preHandler', (req, reply, done) => {
        if (req.url === basePath) {
          reply.redirect(`${req.url}/`, 308)
        }

        done()
      })
    }

    /*
      Some frontends, like Astro (https://github.com/withastro/astro/issues/11445)
      generate invalid paths in development mode which ignore the basePath.
      In that case we try to properly redirect the browser by trying to understand the prefix
      from the Referer header.
    */
    app.addHook('preHandler', (req, reply, done) => {
      // If the URL is already targeted to the service, do nothing
      if (req.url.startsWith(basePath)) {
        done()
        return
      }

      // Use the referer to understand the desired intent
      const referer = req.headers.referer

      if (!referer) {
        done()
        return
      }

      const path = new URL(referer).pathname

      // If we have a match redirect
      if (path.startsWith(basePath)) {
        reply.redirect(`${basePath}${req.url}`, 308)
      }

      done()
    })

    // Do not show proxied services in Swagger
    if (!service.openapi) {
      app.addHook('onRoute', routeOptions => {
        if (routeOptions.url.startsWith(basePath)) {
          routeOptions.schema ??= {}
          routeOptions.schema.hide = true
        }
      })
    }

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
            'x-forwarded-host': request.hostname
          }

          return headers
        },
        onResponse: (request, reply, res) => {
          app.openTelemetry?.endHTTPSpanClient(reply.request.proxedCallSpan, { statusCode: reply.statusCode })
          reply.send(res)
        }
      }
    })
  }

  opts.context?.stackable?.registerMeta(meta)
})

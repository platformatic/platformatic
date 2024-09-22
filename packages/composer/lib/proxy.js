'use strict'

const { getGlobalDispatcher } = require('undici')
const httpProxy = require('@fastify/http-proxy')
const fp = require('fastify-plugin')

const kITC = Symbol.for('plt.runtime.itc')

async function resolveServiceProxyParameters (service) {
  // Get meta information from the service, if any, to eventually hook up to a TCP port
  const meta = (await globalThis[kITC]?.send('getServiceMeta', service.id))?.composer ?? {}

  const origin = meta.tcp ? meta.url : service.origin

  let prefix = service.proxy?.prefix ?? meta.prefix ?? service.id
  if (prefix.endsWith('/')) {
    prefix = prefix.slice(0, -1)
  }

  let rewritePrefix = ''
  let internalRewriteLocationHeader = true

  if (meta.wantsAbsoluteUrls) {
    rewritePrefix = meta.prefix ?? service.id
    internalRewriteLocationHeader = false
  }

  return { origin, prefix, rewritePrefix, internalRewriteLocationHeader, needsRootRedirect: meta.needsRootRedirect }
}

module.exports = fp(async function (app, opts) {
  const meta = { proxies: {} }

  for (const service of opts.services) {
    if (!service.proxy) {
      // When a service defines no expose config at all
      // we assume a proxy exposed with a prefix equals to its id or meta.prefix
      if (service.proxy === false || service.openapi || service.graphql) {
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
          app.inject({
            method: req.method,
            url: `${basePath}/`,
            headers: req.headers,
            payload: req.body
          }, (err, result) => {
            if (err) {
              done(err)
              return
            }

            const replyHeaders = result.headers
            delete replyHeaders['content-length']
            delete replyHeaders['transfer-encoding']

            reply
              .code(result.statusCode)
              .headers(replyHeaders)
              .send(result.rawPayload)
            done()
          })
        } else {
          done()
        }
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
            'x-forwarded-host': request.host,
          }

          return headers
        },
        onResponse: (request, reply, res) => {
          app.openTelemetry?.endHTTPSpanClient(reply.request.proxedCallSpan, { statusCode: reply.statusCode })
          reply.send(res.stream)
        },
      },
    })
  }

  opts.context?.stackable?.registerMeta(meta)
})

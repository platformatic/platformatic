'use strict'

const httpProxy = require('@fastify/http-proxy')
const fp = require('fastify-plugin')
const { workerData } = require('node:worker_threads')
const { getGlobalDispatcher } = require('undici')

const kITC = Symbol.for('plt.runtime.itc')
const kProxyRoute = Symbol('plt.composer.proxy.route')

const urlPattern = /^https?:\/\//

async function resolveServiceProxyParameters (service) {
  // Get meta information from the service, if any, to eventually hook up to a TCP port
  const meta = (await globalThis[kITC]?.send('getServiceMeta', service.id))?.composer ?? { prefix: service.id }

  // If no prefix could be found, assume the service id
  let prefix = (service.proxy?.prefix ?? meta.prefix ?? service.id).replace(/(\/$)/g, '')
  let rewritePrefix = ''
  let internalRewriteLocationHeader = true

  if (meta.wantsAbsoluteUrls) {
    const basePath = workerData.config.basePath

    // Strip the runtime basepath from the prefix when it comes from the service meta
    if (basePath && !service.proxy?.prefix && prefix.startsWith(basePath)) {
      prefix = prefix.substring(basePath.length)
    }

    // The rewritePrefix purposely ignores service.proxy?.prefix to let
    // the service always being able to configure their value
    rewritePrefix = meta.prefix ?? service.id
    internalRewriteLocationHeader = false
  }

  return {
    origin: service.origin,
    url: meta.url,
    prefix,
    rewritePrefix,
    internalRewriteLocationHeader,
    needsRootRedirect: meta.needsRootRedirect,
    needsRefererBasedRedirect: meta.needsRefererBasedRedirect
  }
}

module.exports = fp(async function (app, opts) {
  const meta = { proxies: {} }
  const allDomains = opts.services.map(s => s.proxy?.hostname).filter(Boolean)

  for (const service of opts.services) {
    if (!service.proxy) {
      // When a service defines no expose config at all
      // we assume a proxy exposed with a prefix equals to its id or meta.prefix
      if (service.proxy === false || service.openapi || service.graphql) {
        continue
      }
    }

    const parameters = await resolveServiceProxyParameters(service)
    const {
      prefix,
      origin,
      url,
      rewritePrefix,
      internalRewriteLocationHeader,
      needsRootRedirect,
      needsRefererBasedRedirect
    } = parameters
    meta.proxies[service.id] = parameters

    const basePath = `/${prefix ?? ''}`.replaceAll(/\/+/g, '/').replace(/\/$/, '')
    const dispatcher = getGlobalDispatcher()

    if (needsRootRedirect) {
      app.addHook('preHandler', (req, reply, done) => {
        if (req.url === basePath) {
          app.inject(
            {
              method: req.method,
              url: `${basePath}/`,
              headers: req.headers,
              payload: req.body
            },
            (err, result) => {
              if (err) {
                done(err)
                return
              }

              const replyHeaders = result.headers
              delete replyHeaders['content-length']
              delete replyHeaders['transfer-encoding']

              reply.code(result.statusCode).headers(replyHeaders).send(result.rawPayload)
              done()
            }
          )
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
    if (needsRefererBasedRedirect) {
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
    }

    // Do not show proxied services in Swagger
    if (!service.openapi) {
      app.addHook('onRoute', routeOptions => {
        if (routeOptions.config?.[kProxyRoute] && routeOptions.url.startsWith(basePath)) {
          routeOptions.schema ??= {}
          routeOptions.schema.hide = true
        }
      })
    }

    const toReplace = url
      ? new RegExp(
        url
          .replace(/127\.0\.0\.1/, 'localhost')
          .replace(/\[::\]/, 'localhost')
          .replace('http://', 'https?://')
      )
      : null

    const proxyOptions = {
      websocket: true,
      prefix,
      rewritePrefix,
      upstream: origin,
      wsUpstream: url ?? origin,
      undici: dispatcher,
      destroyAgent: false,
      config: {
        [kProxyRoute]: true
      },
      internalRewriteLocationHeader: false,
      replyOptions: {
        rewriteHeaders: headers => {
          let location = headers.location
          if (location) {
            if (toReplace) {
              location = location.replace(toReplace, '')
            }
            if (!urlPattern.test(location) && internalRewriteLocationHeader) {
              location = location.replace(rewritePrefix, prefix)
            }
            headers.location = location
          }
          return headers
        },
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
            'x-forwarded-proto': request.protocol
          }

          request.log.trace({ headers }, 'rewritten headers before proxying')

          return headers
        },
        onResponse: (request, reply, res) => {
          app.openTelemetry?.endHTTPSpanClient(reply.request.proxedCallSpan, {
            statusCode: reply.statusCode,
            headers: res.headers
          })
          reply.send(res.stream)
        }
      }
    }

    const host = service.proxy?.hostname
    const notHost = allDomains.filter(d => d !== host)

    if (host) {
      await app.register(httpProxy, {
        ...proxyOptions,
        prefix: '/',
        constraints: { host }
      })

      await app.register(httpProxy, {
        ...proxyOptions,
        ...(notHost.length ? { constraints: { notHost } } : {})
      })
    } else {
      await app.register(httpProxy, proxyOptions)
    }
  }

  opts.context?.stackable?.registerMeta(meta)
})

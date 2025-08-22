import httpProxy from '@fastify/http-proxy'
import { ensureLoggableError, loadModule } from '@platformatic/foundation'
import fp from 'fastify-plugin'
import { createRequire } from 'node:module'
import { workerData } from 'node:worker_threads'
import { getGlobalDispatcher } from 'undici'
import { initMetrics } from './metrics.js'

const kITC = Symbol.for('plt.runtime.itc')
const kProxyRoute = Symbol('plt.composer.proxy.route')

const urlPattern = /^https?:\/\//

async function resolveApplicationProxyParameters (application) {
  // Get meta information from the application, if any, to eventually hook up to a TCP port
  const meta = (await globalThis[kITC]?.send('getApplicationMeta', application.id))?.composer ?? {
    prefix: application.id
  }

  // If no prefix could be found, assume the application id
  let prefix = (application.proxy?.prefix ?? meta.prefix ?? application.id).replace(/(\/$)/g, '')
  let rewritePrefix = ''
  let internalRewriteLocationHeader = true

  if (meta.wantsAbsoluteUrls) {
    const basePath = workerData.config.basePath

    // Strip the runtime basepath from the prefix when it comes from the application meta
    if (basePath && !application.proxy?.prefix && prefix.startsWith(basePath)) {
      prefix = prefix.substring(basePath.length)
    }

    // The rewritePrefix purposely ignores application.proxy?.prefix to let
    // the application always being able to configure their value
    rewritePrefix = meta.prefix ?? application.id
    internalRewriteLocationHeader = false
  }

  if (application.proxy?.ws?.hooks) {
    const hooks = await loadModule(createRequire(import.meta.filename), application.proxy.ws.hooks.path)
    application.proxy.ws.hooks = hooks
  }

  return {
    origin: application.origin,
    url: meta.url,
    prefix,
    rewritePrefix,
    internalRewriteLocationHeader,
    needsRootTrailingSlash: meta.needsRootTrailingSlash,
    needsRefererBasedRedirect: meta.needsRefererBasedRedirect,
    upstream: application.proxy?.upstream,
    ws: application.proxy?.ws
  }
}

let metrics

async function proxyPlugin (app, opts) {
  const meta = { proxies: {} }
  const hostnameLessProxies = []

  for (const application of opts.applications) {
    if (!application.proxy) {
      // When a application defines no expose config at all
      // we assume a proxy exposed with a prefix equals to its id or meta.prefix
      if (application.proxy === false || application.openapi || application.graphql) {
        continue
      }
    }

    const parameters = await resolveApplicationProxyParameters(application)
    const {
      prefix,
      origin,
      url,
      rewritePrefix,
      internalRewriteLocationHeader,
      needsRootTrailingSlash,
      needsRefererBasedRedirect,
      ws
    } = parameters
    meta.proxies[application.id] = parameters

    const basePath = `/${prefix ?? ''}`.replaceAll(/\/+/g, '/').replace(/\/$/, '')
    const dispatcher = getGlobalDispatcher()

    let preRewrite = null

    if (needsRootTrailingSlash) {
      preRewrite = function preRewrite (url) {
        if (url === basePath) {
          url += '/'
        }

        return url
      }
    }

    /*
      Some frontends, like Astro (https://github.com/withastro/astro/issues/11445)
      generate invalid paths in development mode which ignore the basePath.
      In that case we try to properly redirect the browser by trying to understand the prefix
      from the Referer header.
    */
    if (needsRefererBasedRedirect) {
      app.addHook('preHandler', function refererBasedRedirectPreHandler (req, reply, done) {
        // If the URL is already targeted to the application, do nothing
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

    // Do not show proxied applications in Swagger
    if (!application.openapi) {
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

    if (!metrics) {
      metrics = initMetrics(globalThis.platformatic?.prometheus)
    }

    const proxyOptions = {
      prefix,
      rewritePrefix,
      upstream: application.proxy?.upstream ?? origin,
      preRewrite,

      websocket: true,
      wsUpstream: ws?.upstream ?? url ?? origin,
      wsReconnect: ws?.reconnect,
      wsHooks: {
        onConnect: (...args) => {
          metrics?.activeWsConnections?.inc()
          ws?.hooks?.onConnect(...args)
        },
        onDisconnect: (...args) => {
          metrics?.activeWsConnections?.dec()
          ws?.hooks?.onDisconnect(...args)
        },
        onReconnect: ws?.hooks?.onReconnect,
        onPong: ws?.hooks?.onPong,
        onIncomingMessage: ws?.hooks?.onIncomingMessage,
        onOutgoingMessage: ws?.hooks?.onOutgoingMessage
      },

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
          // - request.proxedCallSpan: the span of the request to the proxied application
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
        onResponse: (_, reply, res) => {
          app.openTelemetry?.endHTTPSpanClient(reply.request.proxedCallSpan, {
            statusCode: reply.statusCode,
            headers: res.headers
          })
          reply.send(res.stream)
        },
        onError: (reply, { error }) => {
          app.log.error({ error: ensureLoggableError(error) }, 'Error while proxying request to another application')
          return reply.send(error)
        }
      }
    }

    hostnameLessProxies.push(proxyOptions)

    const host = application.proxy?.hostname

    if (host) {
      await app.register(httpProxy, {
        ...proxyOptions,
        prefix: '/',
        constraints: { host }
      })
    }
  }

  const hostnames = opts.applications.map(s => s.proxy?.hostname).filter(Boolean)
  for (const options of hostnameLessProxies) {
    if (hostnames.length > 0) {
      options.constraints = { notHost: hostnames }
    }

    await app.register(httpProxy, options)
  }

  opts.capability?.registerMeta(meta)
}

export const proxy = fp(proxyPlugin)

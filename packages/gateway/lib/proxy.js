import httpProxy from '@fastify/http-proxy'
import { ensureLoggableError, loadModule } from '@platformatic/foundation'
import { getITC, getPrometheus } from '@platformatic/globals'
import fp from 'fastify-plugin'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { workerData } from 'node:worker_threads'
import { getGlobalDispatcher } from 'undici'
import { createDeduplicationHandler } from './deduplication/index.js'
import { WsNoTcpUpstreamError } from './errors.js'
import { initMetrics } from './metrics.js'

const kProxyRoute = Symbol('plt.gateway.proxy.route')

const urlPattern = /^https?:\/\//

function isLocalApplication (application) {
  if (!application.origin) {
    return true
  }

  return application.origin.endsWith('.plt.local')
}

async function resolveApplicationProxyParameters (application, root) {
  // Get meta information from the application, if any, to eventually hook up to a TCP port
  // Only fetch meta for local applications - remote applications won't be in the runtime
  let allMeta = {}
  const itc = isLocalApplication(application) ? getITC({ throwOnMissing: false }) : undefined
  if (itc) {
    allMeta = await itc.send('getApplicationMeta', application.id)
  }
  const meta = allMeta.gateway ?? allMeta.composer ?? { prefix: application.id }

  // If no prefix could be found, assume the application id
  let prefix = (application.proxy?.prefix ?? meta.prefix ?? application.id).replace(/(\/$)/g, '')
  let rewritePrefix = application.proxy?.rewritePrefix ?? ''
  let internalRewriteLocationHeader = true

  if (meta.wantsAbsoluteUrls) {
    const basePath = workerData.config.basePath

    // Strip the runtime basepath from the prefix when it comes from the application meta
    if (basePath && !application.proxy?.prefix && prefix.startsWith(basePath)) {
      prefix = prefix.substring(basePath.length)
    }

    // The rewritePrefix purposely ignores application.proxy?.prefix to let
    // the application always being able to configure their value
    if (!application.proxy?.rewritePrefix) {
      rewritePrefix = meta.prefix ?? application.id
      internalRewriteLocationHeader = false
    }
  }

  if (typeof application.proxy?.rewriteLocationHeader === 'boolean') {
    internalRewriteLocationHeader = application.proxy.rewriteLocationHeader
  }

  const require = createRequire(import.meta.filename)

  if (application.proxy?.custom) {
    const { path, options } = application.proxy.custom
    let custom = await loadModule(require, resolve(root, path))

    // When the module exports a function, it is used as a factory which receives
    // the options defined in the configuration and returns the hooks object.
    if (typeof custom === 'function') {
      custom = await custom(options ?? {})
    }

    application.proxy.custom = custom
  }

  if (application.proxy?.ws?.hooks) {
    const hooks = await loadModule(require, resolve(root, application.proxy.ws.hooks.path))
    application.proxy.ws.hooks = hooks
  }

  return {
    origin: application.origin,
    methods: application.proxy?.methods,
    routes: application.proxy?.routes,
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
  const root = opts.capability?.root ?? import.meta.dirname

  let handler
  if (opts.handler) {
    const require = createRequire(import.meta.filename)
    const custom = await loadModule(require, resolve(root, opts.handler))

    if (typeof custom.handler === 'function') {
      handler = custom.handler
    } else if (typeof custom.default === 'function') {
      handler = custom.default
    }
  }

  for (const application of opts.applications) {
    if (!application.proxy) {
      // When a application defines no expose config at all
      // we assume a proxy exposed with a prefix equals to its id or meta.prefix
      if (application.proxy === false || application.openapi || application.graphql) {
        continue
      }
    }

    const parameters = await resolveApplicationProxyParameters(application, root)
    const {
      prefix,
      origin,
      url,
      routes,
      methods,
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
      const prometheus = getPrometheus({ throwOnMissing: false })
      metrics = initMetrics(prometheus)
    }

    const getUpstream = application.proxy?.custom?.getUpstream
    const customRewriteHeaders = application.proxy?.custom?.rewriteHeaders
    const customOnError = application.proxy?.custom?.onError
    // When getUpstream is provided, upstream ust be undefined, otherwise the getUpstream will be ignored
    const upstream = getUpstream ? undefined : (application.proxy?.upstream ?? origin)

    // A WebSocket upgrade to this application can never succeed: the resolved WS upstream
    // (see wsUpstream below) would be the virtual mesh origin, which the raw WebSocket
    // client used by @fastify/http-proxy cannot resolve, so the upgrade would hang.
    // The absence checks deliberately mirror the nullish semantics of the wsUpstream expression.
    const wsMeshOnly = isLocalApplication(application) && url == null && ws?.upstream == null && getUpstream == null

    let wsGuardPreHandler
    if (wsMeshOnly) {
      if (ws) {
        // The user explicitly configured proxy.ws for an application which cannot accept
        // WebSocket connections: warn at boot instead of letting the first upgrade fail.
        app.log.warn(
          `The "${application.id}" application has WebSocket options configured in "proxy.ws" but it does not expose a TCP server. WebSocket upgrades to this application will fail. Make the application listen on a TCP port (e.g. "useHttp": true), set "proxy.ws.upstream", or provide a custom "proxy.custom.getUpstream".`
        )
      }

      // @fastify/http-proxy dispatches WebSocket upgrades through the regular Fastify
      // router, so a route-level preHandler rejects the upgrade before any dial attempt.
      wsGuardPreHandler = function wsMeshOnlyGuard (request, reply, done) {
        if (typeof request.headers.upgrade === 'string' && request.headers.upgrade.toLowerCase() === 'websocket') {
          done(new WsNoTcpUpstreamError(application.id))
          return
        }

        done()
      }
    }

    let proxyHandler = handler
    if (opts.deduplication?.enabled === true || application.proxy?.deduplication?.enabled === true) {
      proxyHandler = await createDeduplicationHandler({
        app,
        application,
        baseConfig: opts.deduplication,
        overrideConfig: application.proxy?.deduplication,
        handler,
        metrics,
        root
      })
    }

    const proxyOptions = {
      prefix,
      rewritePrefix,
      upstream,
      handler: proxyHandler,
      preRewrite: application.proxy?.custom?.preRewrite ?? preRewrite,
      preValidation: application.proxy?.custom?.preValidation,
      preHandler: wsGuardPreHandler,

      websocket: true,
      // When getUpstream is provided and no explicit WebSocket upstream is configured,
      // leave wsUpstream undefined so that getUpstream is used to select the upstream per-connection
      wsUpstream: ws?.upstream ?? (getUpstream ? undefined : (url ?? origin)),
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

      httpMethods: methods,
      routes,
      internalRewriteLocationHeader: false,
      replyOptions: {
        rewriteHeaders: (headers, request) => {
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

          if (customRewriteHeaders) {
            headers = customRewriteHeaders(headers, request) ?? headers
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

          if (customOnError) {
            return customOnError(reply, { error })
          }

          return reply.send(error)
        },
        getUpstream
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

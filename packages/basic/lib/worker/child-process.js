import { ITC } from '@platformatic/itc'
import { client, collectMetrics } from '@platformatic/metrics'
import {
  buildPinoFormatters,
  buildPinoTimestamp,
  disablePinoDirectWrite,
  ensureFlushedWorkerStdio,
  ensureLoggableError,
  features
} from '@platformatic/utils'
import diagnosticChannel, { tracingChannel } from 'node:diagnostics_channel'
import { EventEmitter, once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { ServerResponse } from 'node:http'
import { register } from 'node:module'
import { hostname, platform, tmpdir } from 'node:os'
import { basename, resolve } from 'node:path'
import { isMainThread } from 'node:worker_threads'
import pino from 'pino'
import { Agent, Pool, setGlobalDispatcher } from 'undici'
import { WebSocket } from 'ws'
import { exitCodes } from '../errors.js'
import { importFile } from '../utils.js'
import { getSocketPath } from './child-manager.js'

const windowsNpmExecutables = ['npm-prefix.js', 'npm-cli.js']

function createInterceptor () {
  const pool = new Pool(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: getSocketPath(process.env.PLT_MANAGER_ID),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  return function (dispatch) {
    return (opts, handler) => {
      let url = opts.origin
      if (!(url instanceof URL)) {
        url = new URL(opts.path, url)
      }

      // Other URLs are handled normally
      if (!url.hostname.endsWith('.plt.local')) {
        return dispatch(opts, handler)
      }

      // Route the call via the UNIX socket
      return pool.dispatch(
        {
          ...opts,
          headers: {
            host: url.host,
            ...opts?.headers
          }
        },
        handler
      )
    }
  }
}

export class ChildProcess extends ITC {
  #listener
  #socket
  #logger
  #metricsRegistry
  #pendingMessages

  constructor () {
    super({
      throwOnMissingHandler: false,
      name: `${process.env.PLT_MANAGER_ID}-child-process`,
      handlers: {
        collectMetrics: (...args) => {
          return this.#collectMetrics(...args)
        },
        getMetrics: (...args) => {
          return this.#getMetrics(...args)
        },
        close: signal => {
          let handled = false

          try {
            handled = globalThis.platformatic.events.emit('close', signal)
          } catch (error) {
            this.#logger.error({ err: ensureLoggableError(error) }, 'Error while handling close event.')
            process.exitCode = 1
          }

          if (!handled) {
            // No user event, just exit without errors
            setImmediate(() => {
              process.exit(process.exitCode ?? 0)
            })
          }

          return handled
        }
      }
    })

    /* c8 ignore next */
    const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
    this.#socket = new WebSocket(`${protocol}${getSocketPath(process.env.PLT_MANAGER_ID)}`)
    this.#pendingMessages = []
    this.#metricsRegistry = new client.Registry()

    this.listen()
    this.#setupLogger()

    if (globalThis.platformatic.handleUnhandledErrors) {
      this.#setupHandlers()
    }

    this.#setupServer()
    this.#setupInterceptors()

    this.registerGlobals({
      logger: this.#logger,
      setOpenapiSchema: this.setOpenapiSchema.bind(this),
      setGraphqlSchema: this.setGraphqlSchema.bind(this),
      setConnectionString: this.setConnectionString.bind(this),
      setBasePath: this.setBasePath.bind(this),
      prometheus: { client, registry: this.#metricsRegistry },
      notifyConfig: this.#notifyConfig.bind(this)
    })
  }

  registerGlobals (globals) {
    globalThis.platformatic = Object.assign(globalThis.platformatic ?? {}, globals)
  }

  setOpenapiSchema (schema) {
    this.notify('openapiSchema', schema)
  }

  setGraphqlSchema (schema) {
    this.notify('graphqlSchema', schema)
  }

  setConnectionString (connectionString) {
    this.notify('connectionString', connectionString)
  }

  setBasePath (basePath) {
    this.notify('basePath', basePath)
  }

  _setupListener (listener) {
    this.#listener = listener

    this.#socket.on('open', () => {
      // Never hang the process on this socket.
      this.#socket._socket.unref()

      /* c8 ignore next 3 */
      for (const message of this.#pendingMessages) {
        this.#socket.send(message)
      }
    })

    this.#socket.on('message', message => {
      try {
        this.#listener(JSON.parse(message))
      } catch (error) {
        this.#logger.error({ err: ensureLoggableError(error) }, 'Handling a message failed.')
        process.exit(exitCodes.PROCESS_MESSAGE_HANDLING_FAILED)
      }
    })

    /* c8 ignore next 5 */
    this.#socket.on('error', error => {
      process._rawDebug(error)
      // There is nothing to log here as the connection with the parent thread is lost. Exit with a special code
      process.exit(exitCodes.PROCESS_SOCKET_ERROR)
    })
  }

  _send (message) {
    /* c8 ignore next 4 */
    if (this.#socket.readyState === WebSocket.CONNECTING) {
      this.#pendingMessages.push(JSON.stringify(message))
      return
    }

    this.#socket.send(JSON.stringify(message))
  }

  _createClosePromise () {
    return once(this.#socket, 'close')
  }

  /* c8 ignore next 3 */
  _close () {
    this.#socket.close()
  }

  async #collectMetrics ({ serviceId, workerId, metricsConfig }) {
    await collectMetrics(serviceId, workerId, metricsConfig, this.#metricsRegistry)
    this.#setHttpCacheMetrics()
  }

  #setHttpCacheMetrics () {
    const { client, registry } = globalThis.platformatic.prometheus

    const cacheHitMetric = new client.Counter({
      name: 'http_cache_hit_count',
      help: 'Number of http cache hits',
      registers: [registry]
    })

    const cacheMissMetric = new client.Counter({
      name: 'http_cache_miss_count',
      help: 'Number of http cache misses',
      registers: [registry]
    })

    globalThis.platformatic.onHttpCacheHit = () => {
      cacheHitMetric.inc()
    }
    globalThis.platformatic.onHttpCacheMiss = () => {
      cacheMissMetric.inc()
    }

    const httpStatsFreeMetric = new client.Gauge({
      name: 'http_client_stats_free',
      help: 'Number of free (idle) http clients (sockets)',
      labelNames: ['dispatcher_stats_url'],
      registers: [registry]
    })
    globalThis.platformatic.onHttpStatsFree = (url, val) => {
      httpStatsFreeMetric.set({ dispatcher_stats_url: url }, val)
    }

    const httpStatsConnectedMetric = new client.Gauge({
      name: 'http_client_stats_connected',
      help: 'Number of open socket connections',
      labelNames: ['dispatcher_stats_url'],
      registers: [registry]
    })
    globalThis.platformatic.onHttpStatsConnected = (url, val) => {
      httpStatsConnectedMetric.set({ dispatcher_stats_url: url }, val)
    }

    const httpStatsPendingMetric = new client.Gauge({
      name: 'http_client_stats_pending',
      help: 'Number of pending requests across all clients',
      labelNames: ['dispatcher_stats_url'],
      registers: [registry]
    })
    globalThis.platformatic.onHttpStatsPending = (url, val) => {
      httpStatsPendingMetric.set({ dispatcher_stats_url: url }, val)
    }

    const httpStatsQueuedMetric = new client.Gauge({
      name: 'http_client_stats_queued',
      help: 'Number of queued requests across all clients',
      labelNames: ['dispatcher_stats_url'],
      registers: [registry]
    })
    globalThis.platformatic.onHttpStatsQueued = (url, val) => {
      httpStatsQueuedMetric.set({ dispatcher_stats_url: url }, val)
    }

    const httpStatsRunningMetric = new client.Gauge({
      name: 'http_client_stats_running',
      help: 'Number of currently active requests across all clients',
      labelNames: ['dispatcher_stats_url'],
      registers: [registry]
    })
    globalThis.platformatic.onHttpStatsRunning = (url, val) => {
      httpStatsRunningMetric.set({ dispatcher_stats_url: url }, val)
    }

    const httpStatsSizeMetric = new client.Gauge({
      name: 'http_client_stats_size',
      help: 'Number of active, pending, or queued requests across all clients',
      labelNames: ['dispatcher_stats_url'],
      registers: [registry]
    })
    globalThis.platformatic.onHttpStatsSize = (url, val) => {
      httpStatsSizeMetric.set({ dispatcher_stats_url: url }, val)
    }

    const activeResourcesEventLoopMetric = new client.Gauge({
      name: 'active_resources_event_loop',
      help: 'Number of active resources keeping the event loop alive',
      registers: [registry]
    })
    globalThis.platformatic.onActiveResourcesEventLoop = val => activeResourcesEventLoopMetric.set(val)
  }

  async #getMetrics ({ format } = {}) {
    const res =
      format === 'json' ? await this.#metricsRegistry.getMetricsAsJSON() : await this.#metricsRegistry.metrics()

    return res
  }

  #setupLogger () {
    disablePinoDirectWrite()
    ensureFlushedWorkerStdio()

    // Since this is executed by user code, make sure we only override this in the main thread
    // The rest will be intercepted by the BaseStackable.
    const loggerOptions = globalThis.platformatic?.config?.logger ?? {}
    const pinoOptions = {
      ...loggerOptions,
      level: loggerOptions.level ?? 'info',
      name: globalThis.platformatic.serviceId
    }
    if (loggerOptions.formatters) {
      pinoOptions.formatters = buildPinoFormatters(loggerOptions.formatters)
    }
    if (loggerOptions.timestamp) {
      pinoOptions.timestamp = buildPinoTimestamp(loggerOptions.timestamp)
    }

    if (loggerOptions.base !== null && typeof globalThis.platformatic.workerId !== 'undefined') {
      pinoOptions.base = {
        ...(pinoOptions.base ?? {}),
        pid: process.pid,
        hostname: hostname(),
        worker: parseInt(globalThis.platformatic.workerId)
      }
    } else if (loggerOptions.base === null) {
      pinoOptions.base = undefined
    }

    this.#logger = pino(pinoOptions)
  }

  #setupServer () {
    const subscribers = {
      asyncStart ({ options }) {
        // Unix socket, do nothing
        if (options.path) {
          return
        }

        const port = globalThis.platformatic.port
        const host = globalThis.platformatic.host

        if (port !== false) {
          const hasFixedPort = typeof port === 'number'
          options.port = hasFixedPort ? port : 0

          if (hasFixedPort && features.node.reusePort) {
            options.reusePort = true
          }
        }

        if (typeof host === 'string') {
          options.host = host
        }
      },
      asyncEnd: ({ server }) => {
        tracingChannel('net.server.listen').unsubscribe(subscribers)

        const address = server.address()

        // Unix socket, do nothing
        if (typeof address === 'string') {
          return
        }

        const { family, address: host, port } = address
        /* c8 ignore next */
        const url = new URL(family === 'IPv6' ? `http://[${host}]:${port}` : `http://${host}:${port}`).origin

        this.notify('url', url)
      },
      error: ({ error }) => {
        tracingChannel('net.server.listen').unsubscribe(subscribers)
        this.notify('error', error)
      }
    }

    tracingChannel('net.server.listen').subscribe(subscribers)

    const { isEntrypoint, runtimeBasePath, wantsAbsoluteUrls } = globalThis.platformatic
    if (isEntrypoint && runtimeBasePath && !wantsAbsoluteUrls) {
      stripBasePath(runtimeBasePath)
    }
  }

  #setupInterceptors () {
    const globalDispatcher = new Agent().compose(createInterceptor(this))
    setGlobalDispatcher(globalDispatcher)
  }

  #setupHandlers () {
    const errorLabel =
      typeof globalThis.platformatic.workerId !== 'undefined'
        ? `worker ${globalThis.platformatic.workerId} of the service "${globalThis.platformatic.serviceId}"`
        : `service "${globalThis.platformatic.serviceId}"`

    function handleUnhandled (type, err) {
      this.#logger.error({ err: ensureLoggableError(err) }, `Child process for the ${errorLabel} threw an ${type}.`)

      // Give some time to the logger and ITC notifications to land before shutting down
      setTimeout(() => process.exit(exitCodes.PROCESS_UNHANDLED_ERROR), 100)
    }

    process.on('uncaughtException', handleUnhandled.bind(this, 'uncaught exception'))
    process.on('unhandledRejection', handleUnhandled.bind(this, 'unhandled rejection'))
  }

  #notifyConfig (config) {
    this.notify('config', config)
  }
}

function stripBasePath (basePath) {
  const kBasePath = Symbol('kBasePath')

  diagnosticChannel.subscribe('http.server.request.start', ({ request, response }) => {
    if (request.url.startsWith(basePath)) {
      request.url = request.url.slice(basePath.length)

      if (request.url.charAt(0) !== '/') {
        request.url = '/' + request.url
      }

      response[kBasePath] = basePath
    }
  })

  const originWriteHead = ServerResponse.prototype.writeHead
  const originSetHeader = ServerResponse.prototype.setHeader

  ServerResponse.prototype.writeHead = function (statusCode, statusMessage, headers) {
    if (this[kBasePath] !== undefined) {
      if (headers === undefined && typeof statusMessage === 'object') {
        headers = statusMessage
        statusMessage = undefined
      }

      if (headers) {
        for (const key in headers) {
          if (key.toLowerCase() === 'location' && !headers[key].startsWith(basePath)) {
            headers[key] = basePath + headers[key]
          }
        }
      }
    }

    return originWriteHead.call(this, statusCode, statusMessage, headers)
  }

  ServerResponse.prototype.setHeader = function (name, value) {
    if (this[kBasePath]) {
      if (name.toLowerCase() === 'location' && !value.startsWith(basePath)) {
        value = basePath + value
      }
    }
    originSetHeader.call(this, name, value)
  }
}

async function main () {
  const executable = basename(process.argv[1] ?? '')
  if (!isMainThread || windowsNpmExecutables.includes(executable)) {
    return
  }

  const dataPath = resolve(tmpdir(), 'platformatic', 'runtimes', `${process.env.PLT_MANAGER_ID}.json`)
  const { data, loader, scripts } = JSON.parse(await readFile(dataPath))

  globalThis.platformatic = data
  globalThis.platformatic.events = new EventEmitter()

  if (loader) {
    register(loader, { data })
  }

  for (const script of scripts) {
    await importFile(script)
  }

  globalThis[Symbol.for('plt.children.itc')] = new ChildProcess()
}

await main()

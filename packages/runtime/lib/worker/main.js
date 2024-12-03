'use strict'

const { EventEmitter } = require('node:events')
const { createRequire } = require('node:module')
const { hostname } = require('node:os')
const { join } = require('node:path')
const { parentPort, workerData, threadId } = require('node:worker_threads')
const { pathToFileURL } = require('node:url')
const inspector = require('node:inspector')
const diagnosticChannel = require('node:diagnostics_channel')
const { ServerResponse } = require('node:http')

const pino = require('pino')
const { fetch, setGlobalDispatcher, getGlobalDispatcher, Agent } = require('undici')
const { wire } = require('undici-thread-interceptor')
const undici = require('undici')

const RemoteCacheStore = require('./http-cache')
const { PlatformaticApp } = require('./app')
const { setupITC } = require('./itc')
const loadInterceptors = require('./interceptors')
const { createTelemetryThreadInterceptorHooks } = require('@platformatic/telemetry')

const {
  MessagePortWritable,
  createPinoWritable,
  executeWithTimeout,
  ensureLoggableError
} = require('@platformatic/utils')
const { kId, kITC } = require('./symbols')

process.on('uncaughtException', handleUnhandled.bind(null, 'uncaught exception'))
process.on('unhandledRejection', handleUnhandled.bind(null, 'unhandled rejection'))

globalThis.fetch = fetch
globalThis[kId] = threadId

let app

const config = workerData.config
globalThis.platformatic = Object.assign(globalThis.platformatic ?? {}, {
  logger: createLogger(),
  events: new EventEmitter()
})

function handleUnhandled (type, err) {
  const label =
    workerData.worker.count > 1
      ? `worker ${workerData.worker.index} of the service "${workerData.serviceConfig.id}"`
      : `service "${workerData.serviceConfig.id}"`

  globalThis.platformatic.logger.error({ err: ensureLoggableError(err) }, `The ${label} threw an ${type}.`)

  executeWithTimeout(app?.stop(), 1000)
    .catch()
    .finally(() => {
      process.exit(1)
    })
}

function createLogger () {
  const destination = new MessagePortWritable({ port: workerData.loggingPort })
  const pinoOptions = { level: 'trace', name: workerData.serviceConfig.id }

  if (typeof workerData.worker?.index !== 'undefined') {
    pinoOptions.base = { pid: process.pid, hostname: hostname(), worker: workerData.worker.index }
  }

  const loggerInstance = pino(pinoOptions, destination)

  Reflect.defineProperty(process, 'stdout', { value: createPinoWritable(loggerInstance, 'info') })
  Reflect.defineProperty(process, 'stderr', { value: createPinoWritable(loggerInstance, 'error') })

  return loggerInstance
}

async function main () {
  if (config.preload) {
    await import(pathToFileURL(config.preload))
  }

  const service = workerData.serviceConfig

  // Setup undici
  const interceptors = {}
  const composedInterceptors = []

  if (config.undici?.interceptors) {
    const _require = createRequire(join(workerData.dirname, 'package.json'))
    for (const key of ['Agent', 'Pool', 'Client']) {
      if (config.undici.interceptors[key]) {
        interceptors[key] = await loadInterceptors(_require, config.undici.interceptors[key])
      }
    }

    if (Array.isArray(config.undici.interceptors)) {
      composedInterceptors.push(...(await loadInterceptors(_require, config.undici.interceptors)))
    }
  }

  const dispatcherOpts = { ...config.undici }

  if (Object.keys(interceptors).length > 0) {
    const clientInterceptors = []
    const poolInterceptors = []

    if (interceptors.Agent) {
      clientInterceptors.push(...interceptors.Agent)
      poolInterceptors.push(...interceptors.Agent)
    }

    if (interceptors.Pool) {
      poolInterceptors.push(...interceptors.Pool)
    }

    if (interceptors.Client) {
      clientInterceptors.push(...interceptors.Client)
    }

    dispatcherOpts.factory = (origin, opts) => {
      return opts && opts.connections === 1
        ? new undici.Client(origin, opts).compose(clientInterceptors)
        : new undici.Pool(origin, opts).compose(poolInterceptors)
    }
  }

  const globalDispatcher = new Agent(dispatcherOpts)
    .compose(composedInterceptors)

  setGlobalDispatcher(globalDispatcher)

  const { telemetry } = service
  const hooks = telemetry ? createTelemetryThreadInterceptorHooks() : {}
  // Setup mesh networker
  const threadDispatcher = wire({
    port: parentPort,
    useNetwork: service.useHttp,
    timeout: config.serviceTimeout,
    ...hooks
  })

  if (config.httpCache) {
    setGlobalDispatcher(
      getGlobalDispatcher().compose(undici.interceptors.cache({
        store: new RemoteCacheStore(),
        methods: config.httpCache.methods ?? ['GET', 'HEAD']
      }))
    )
  }

  // If the service is an entrypoint and runtime server config is defined, use it.
  let serverConfig = null
  if (config.server && service.entrypoint) {
    serverConfig = config.server
  } else if (service.useHttp) {
    serverConfig = {
      port: 0,
      hostname: '127.0.0.1',
      keepAliveTimeout: 5000
    }
  }

  const inspectorOptions = workerData.inspectorOptions

  if (inspectorOptions) {
    for (let i = 0; !inspector.url(); i++) {
      inspector.open(inspectorOptions.port + i, inspectorOptions.host, inspectorOptions.breakFirstLine)
    }

    const url = new URL(inspector.url())

    url.protocol = 'http'
    url.pathname = '/json/list'

    const res = await fetch(url)
    const [{ devtoolsFrontendUrl }] = await res.json()

    console.log(`For ${service.id} debugger open the following in chrome: "${devtoolsFrontendUrl}"`)
  }

  // Create the application
  app = new PlatformaticApp(
    service,
    workerData.worker.count > 1 ? workerData.worker.index : undefined,
    service.telemetry,
    config.logger,
    serverConfig,
    config.metrics,
    !!config.managementApi,
    !!config.watch
  )

  await app.init()

  if (service.entrypoint && config.basePath) {
    const meta = await app.stackable.getMeta()
    if (!meta.composer.wantsAbsoluteUrls) {
      stripBasePath(config.basePath)
    }
  }

  // Setup interaction with parent port
  const itc = setupITC(app, service, threadDispatcher)
  globalThis[kITC] = itc

  // Get the dependencies
  const dependencies = config.autoload ? await app.getBootstrapDependencies() : []
  itc.notify('init', { dependencies })
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

// No need to catch this because there is the unhadledRejection handler on top.
main()

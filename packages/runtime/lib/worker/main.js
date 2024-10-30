'use strict'

const { createRequire } = require('node:module')
const { join } = require('node:path')
const { parentPort, workerData, threadId } = require('node:worker_threads')
const { pathToFileURL } = require('node:url')
const inspector = require('node:inspector')
const diagnosticChannel = require('node:diagnostics_channel')
const { ServerResponse } = require('node:http')

const pino = require('pino')
const { fetch, setGlobalDispatcher, Agent } = require('undici')
const { wire } = require('undici-thread-interceptor')

const { PlatformaticApp } = require('./app')
const { setupITC } = require('./itc')
const loadInterceptors = require('./interceptors')
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
globalThis.platformatic = Object.assign(globalThis.platformatic ?? {}, { logger: createLogger() })

function handleUnhandled (type, err) {
  globalThis.platformatic.logger.error(
    { err: ensureLoggableError(err) },
    `Service ${workerData.serviceConfig.id} threw an ${type}.`
  )

  executeWithTimeout(app?.stop(), 1000)
    .catch()
    .finally(() => {
      process.exit(1)
    })
}

function createLogger () {
  const destination = new MessagePortWritable({ port: workerData.loggingPort })
  const loggerInstance = pino({ level: 'trace', name: workerData.serviceConfig.id }, destination)

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

  const globalDispatcher = new Agent({
    ...config.undici,
    interceptors
  }).compose(composedInterceptors)

  setGlobalDispatcher(globalDispatcher)

  // Setup mesh networker
  // The timeout is set to 5 minutes to avoid long term memory leaks
  // TODO: make this configurable
  const threadDispatcher = wire({ port: parentPort, useNetwork: service.useHttp, timeout: 5 * 60 * 1000 })

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

  let telemetryConfig = config.telemetry
  if (telemetryConfig) {
    telemetryConfig = {
      ...telemetryConfig,
      serviceName: `${telemetryConfig.serviceName}-${service.id}`
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
    telemetryConfig,
    config.logger,
    serverConfig,
    config.metrics,
    !!config.managementApi,
    !!config.watch
  )

  await app.init()

  if (service.entrypoint && config.basePath) {
    const meta = await app.stackable.getMeta()
    if (!meta.wantsAbsoluteUrls) {
      stripBasePath(config.basePath)
    }
  }

  // Setup interaction with parent port
  const itc = setupITC(app, service, threadDispatcher)

  // Get the dependencies
  const dependencies = config.autoload ? await app.getBootstrapDependencies() : []
  itc.notify('init', { dependencies })
  itc.listen()

  globalThis[kITC] = itc
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
          if (
            key.toLowerCase() === 'location' &&
            !headers[key].startsWith(basePath)
          ) {
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

'use strict'

const { EventEmitter } = require('node:events')
const { hostname } = require('node:os')
const { resolve } = require('node:path')
const { workerData, threadId } = require('node:worker_threads')
const { pathToFileURL } = require('node:url')
const inspector = require('node:inspector')
const diagnosticChannel = require('node:diagnostics_channel')
const { ServerResponse } = require('node:http')

const {
  disablePinoDirectWrite,
  executeWithTimeout,
  ensureLoggableError,
  getPrivateSymbol,
  buildPinoFormatters,
  buildPinoTimestamp
} = require('@platformatic/foundation')
const dotenv = require('dotenv')
const pino = require('pino')
const { fetch } = require('undici')

const { Controller } = require('./controller')
const { SharedContext } = require('./shared-context')
const { setupITC } = require('./itc')
const { setDispatcher } = require('./interceptors')
const { kId, kITC, kStderrMarker } = require('./symbols')

function handleUnhandled (app, type, err) {
  const label =
    workerData.worker.count > 1
      ? `worker ${workerData.worker.index} of the application "${workerData.applicationConfig.id}"`
      : `application "${workerData.applicationConfig.id}"`

  globalThis.platformatic.logger.error({ err: ensureLoggableError(err) }, `The ${label} threw an ${type}.`)

  executeWithTimeout(app?.stop(), 1000)
    .catch()
    .finally(() => {
      process.exit(1)
    })
}

function patchLogging () {
  disablePinoDirectWrite()

  const kFormatForStderr = getPrivateSymbol(console, 'kFormatForStderr')

  // To avoid out of order printing on the main thread, instruct console to only print to the stdout.
  console._stderr = console._stdout
  console._stderrErrorHandler = console._stdoutErrorHandler

  // To recognize stderr in the main thread, each line is prepended with a special private Unicode character.
  const originalFormatter = console[kFormatForStderr]
  console[kFormatForStderr] = function (args) {
    let string = kStderrMarker + originalFormatter(args).replaceAll('\n', '\n' + kStderrMarker)

    if (string.endsWith(kStderrMarker)) {
      string = string.slice(0, -1)
    }

    return string
  }
}

function createLogger () {
  // Do not propagate runtime transports to the worker
  if (workerData.config.logger) {
    delete workerData.config.logger.transport
  }

  const pinoOptions = {
    level: 'trace',
    name: workerData.applicationConfig.id,
    ...workerData.config.logger
  }

  if (workerData.worker?.count > 1) {
    pinoOptions.base = { pid: process.pid, hostname: hostname(), worker: workerData.worker.index }
  }

  if (pinoOptions.formatters) {
    pinoOptions.formatters = buildPinoFormatters(pinoOptions.formatters)
  }
  if (pinoOptions.timestamp) {
    pinoOptions.timestamp = buildPinoTimestamp(pinoOptions.timestamp)
  }

  return pino(pinoOptions)
}

async function performPreloading (...sources) {
  for (const source of sources) {
    const preload = typeof source.preload === 'string' ? [source.preload] : source.preload

    if (Array.isArray(preload)) {
      for (const file of preload) {
        await import(pathToFileURL(file))
      }
    }
  }
}

async function main () {
  globalThis.fetch = fetch
  globalThis[kId] = threadId
  globalThis.platformatic = Object.assign(globalThis.platformatic ?? {}, {
    logger: createLogger(),
    events: new EventEmitter()
  })

  const config = workerData.config

  await performPreloading(config, workerData.applicationConfig)

  const application = workerData.applicationConfig

  // Load env file and mixin env vars from application config
  let envfile
  if (application.envfile) {
    envfile = resolve(workerData.dirname, application.envfile)
  } else {
    envfile = resolve(workerData.applicationConfig.path, '.env')
  }

  globalThis.platformatic.logger.debug({ envfile }, 'Loading envfile...')

  dotenv.config({
    path: envfile
  })

  if (config.env) {
    Object.assign(process.env, config.env)
  }
  if (application.env) {
    Object.assign(process.env, application.env)
  }

  const { threadDispatcher } = await setDispatcher(config)

  // If the application is an entrypoint and runtime server config is defined, use it.
  let serverConfig = null
  if (config.server && application.entrypoint) {
    serverConfig = config.server
  } else if (application.useHttp) {
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

    console.log(`For ${application.id} debugger open the following in chrome: "${devtoolsFrontendUrl}"`)
  }

  // Create the application
  const app = new Controller(
    application,
    workerData.worker.count > 1 ? workerData.worker.index : undefined,
    application.telemetry,
    config.logger,
    serverConfig,
    config.metrics,
    !!config.managementApi,
    !!config.watch
  )

  process.on('uncaughtException', handleUnhandled.bind(null, app, 'uncaught exception'))
  process.on('unhandledRejection', handleUnhandled.bind(null, app, 'unhandled rejection'))

  await app.init()

  if (application.entrypoint && config.basePath) {
    const meta = await app.capability.getMeta()
    if (!meta.composer.wantsAbsoluteUrls) {
      stripBasePath(config.basePath)
    }
  }

  const sharedContext = new SharedContext()
  // Limit the amount of methods a user can call
  globalThis.platformatic.sharedContext = {
    get: () => sharedContext.get(),
    update: (...args) => sharedContext.update(...args)
  }

  // Setup interaction with parent port
  const itc = setupITC(app, application, threadDispatcher, sharedContext)
  globalThis[kITC] = itc

  // Get the dependencies
  const dependencies = await app.getBootstrapDependencies()
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

patchLogging()

// No need to catch this because there is the unhadledRejection handler on top.
main()

import {
  buildPinoFormatters,
  buildPinoTimestamp,
  disablePinoDirectWrite,
  ensureLoggableError,
  executeWithTimeout,
  getPrivateSymbol
} from '@platformatic/foundation'
import dotenv from 'dotenv'
import { subscribe } from 'node:diagnostics_channel'
import { EventEmitter } from 'node:events'
import { ServerResponse } from 'node:http'
import inspector from 'node:inspector'
import { hostname } from 'node:os'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { threadId, workerData } from 'node:worker_threads'
import pino from 'pino'
import { fetch } from 'undici'
import { Controller } from './controller.js'
import { setDispatcher } from './interceptors.js'
import { setupITC } from './itc.js'
import { SharedContext } from './shared-context.js'
import { kId, kITC, kStderrMarker } from './symbols.js'

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
  const controller = new Controller(
    application,
    workerData.worker.count > 1 ? workerData.worker.index : undefined,
    application.telemetry,
    config.logger,
    serverConfig,
    config.metrics,
    !!config.managementApi,
    !!config.watch
  )

  if (config.exitOnUnhandledErrors) {
    process.on('uncaughtException', handleUnhandled.bind(null, controller, 'uncaught exception'))
    process.on('unhandledRejection', handleUnhandled.bind(null, controller, 'unhandled rejection'))

    process.on('newListener', event => {
      if (event === 'uncaughtException' || event === 'unhandledRejection') {
        globalThis.platformatic.logger.warn(
          `A listener has been added for the "process.${event}" event. This listener will be never triggered as Watt default behavior will kill the process before.\n To disable this behavior, set "exitOnUnhandledErrors" to false in the runtime config.`
        )
      }
    })
  }

  await controller.init()

  if (application.entrypoint && config.basePath) {
    const meta = await controller.capability.getMeta()
    if (!meta.gateway.wantsAbsoluteUrls) {
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
  const itc = setupITC(controller, application, threadDispatcher, sharedContext)
  globalThis[kITC] = itc

  itc.notify('init')
}

function stripBasePath (basePath) {
  const kBasePath = Symbol('kBasePath')

  subscribe('http.server.request.start', ({ request, response }) => {
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

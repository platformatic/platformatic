import {
  buildPinoFormatters,
  buildPinoTimestamp,
  disablePinoDirectWrite,
  getPrivateSymbol
} from '@platformatic/foundation'
import { subscribe } from 'node:diagnostics_channel'
import { EventEmitter } from 'node:events'
import { ServerResponse } from 'node:http'
import inspector from 'node:inspector'
import { hostname } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { threadId, workerData } from 'node:worker_threads'
import pino from 'pino'
import { fetch } from 'undici'
import { Controller } from './controller.js'
import { setDispatcher } from './interceptors.js'
import { setupITC } from './itc.js'
import { SharedContext } from './shared-context.js'
import { kId, kITC, kStderrMarker } from './symbols.js'
import { initHealthSignalsApi } from './health-signals.js'

class ForwardingEventEmitter extends EventEmitter {
  emitAndNotify (event, ...args) {
    globalThis.platformatic.itc.notify('event', { event, payload: args })
    return this.emit(event, ...args)
  }
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
    base: { pid: process.pid, hostname: hostname(), worker: workerData.worker.index },
    ...workerData.config.logger
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

// Enable compile cache if configured (Node.js 22.1.0+)
async function setupCompileCache (runtimeConfig, applicationConfig, logger) {
  // Normalize boolean shorthand: true -> { enabled: true }
  const normalizeConfig = cfg => {
    if (cfg === true) return { enabled: true }
    if (cfg === false) return { enabled: false }
    return cfg
  }

  // Merge runtime and app-level config (app overrides runtime)
  const runtimeCache = normalizeConfig(runtimeConfig.compileCache)
  const appCache = normalizeConfig(applicationConfig.compileCache)
  const config = { ...runtimeCache, ...appCache }

  if (!config.enabled) {
    return
  }

  // Check if API is available (Node.js 22.1.0+)
  let moduleApi
  try {
    moduleApi = await import('node:module')
    if (typeof moduleApi.enableCompileCache !== 'function') {
      return
    }
  } catch {
    return
  }

  // Determine cache directory - use applicationConfig.path for the app root
  const cacheDir = config.directory ?? join(applicationConfig.path, '.plt', 'compile-cache')

  try {
    const result = moduleApi.enableCompileCache(cacheDir)

    const { compileCacheStatus } = moduleApi.constants ?? {}

    if (result.status === compileCacheStatus?.ENABLED) {
      logger.debug({ directory: result.directory }, 'Module compile cache enabled')
    } else if (result.status === compileCacheStatus?.ALREADY_ENABLED) {
      logger.debug({ directory: result.directory }, 'Module compile cache already enabled')
    } else if (result.status === compileCacheStatus?.FAILED) {
      logger.warn({ message: result.message }, 'Failed to enable module compile cache')
    } else if (result.status === compileCacheStatus?.DISABLED) {
      logger.debug('Module compile cache disabled via NODE_DISABLE_COMPILE_CACHE')
    }
  } catch (err) {
    logger.warn({ err }, 'Error enabling module compile cache')
  }
}

async function main () {
  globalThis.fetch = fetch
  globalThis[kId] = threadId
  globalThis.platformatic = Object.assign(globalThis.platformatic ?? {}, {
    logger: createLogger(),
    events: new ForwardingEventEmitter()
  })

  const runtimeConfig = workerData.config
  const applicationConfig = workerData.applicationConfig

  // Enable compile cache early before loading user modules
  await setupCompileCache(runtimeConfig, applicationConfig, globalThis.platformatic.logger)

  await performPreloading(runtimeConfig, applicationConfig)

  // Load env file and mixin env vars from application config
  let envfile
  if (applicationConfig.envfile) {
    envfile = resolve(workerData.dirname, applicationConfig.envfile)
  } else {
    envfile = resolve(workerData.applicationConfig.path, '.env')
  }

  globalThis.platformatic.logger.debug({ envfile }, 'Loading envfile...')

  try {
    process.loadEnvFile(envfile)
  } catch {
    // Ignore if the file doesn't exist, similar to dotenv behavior
  }

  if (runtimeConfig.env) {
    Object.assign(process.env, runtimeConfig.env)
  }
  if (applicationConfig.env) {
    Object.assign(process.env, applicationConfig.env)
  }

  const { threadDispatcher } = await setDispatcher(runtimeConfig)

  // If the application is an entrypoint and runtime server config is defined, use it.
  let serverConfig = null
  if (runtimeConfig.server && applicationConfig.entrypoint) {
    serverConfig = runtimeConfig.server
  } else if (applicationConfig.useHttp) {
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

    console.log(`For ${applicationConfig.id} debugger open the following in chrome: "${devtoolsFrontendUrl}"`)
  }

  // Create the application
  // Add idLabel to metrics config to determine which label name to use (defaults to applicationId)
  const metricsConfig = runtimeConfig.metrics
    ? {
        ...runtimeConfig.metrics,
        idLabel: runtimeConfig.metrics.applicationLabel || 'applicationId'
      }
    : runtimeConfig.metrics

  const controller = new Controller(
    runtimeConfig,
    applicationConfig,
    workerData.worker.index,
    serverConfig,
    metricsConfig
  )

  await controller.init()

  if (applicationConfig.entrypoint && runtimeConfig.basePath) {
    const meta = await controller.capability.getMeta()
    if (!meta.gateway.wantsAbsoluteUrls) {
      stripBasePath(runtimeConfig.basePath)
    }
  }

  const sharedContext = new SharedContext()
  // Limit the amount of methods a user can call
  globalThis.platformatic.sharedContext = {
    get: () => sharedContext.get(),
    update: (...args) => sharedContext.update(...args)
  }

  // Setup interaction with parent port
  const itc = setupITC(controller, applicationConfig, threadDispatcher, sharedContext)
  globalThis[kITC] = itc
  globalThis.platformatic.itc = itc

  initHealthSignalsApi({
    workerId: workerData.worker.id,
    applicationId: applicationConfig.id
  })

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

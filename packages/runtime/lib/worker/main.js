'use strict'

const { createRequire } = require('node:module')
const { join } = require('node:path')
const { setTimeout: sleep } = require('node:timers/promises')
const { parentPort, workerData, threadId } = require('node:worker_threads')
const { pathToFileURL } = require('node:url')

const pino = require('pino')
const { fetch, setGlobalDispatcher, Agent } = require('undici')
const { wire } = require('undici-thread-interceptor')

const { PlatformaticApp } = require('./app')
const { setupITC } = require('./itc')
const loadInterceptors = require('./interceptors')
const { MessagePortWritable } = require('./message-port-writable')
const { kId, kITC } = require('./symbols')

process.on('uncaughtException', handleUnhandled.bind(null, 'uncaught exception'))
process.on('unhandledRejection', handleUnhandled.bind(null, 'unhandled rejection'))

globalThis.fetch = fetch
globalThis[kId] = threadId

let app
const config = workerData.config
const logger = createLogger()

function handleUnhandled (type, err) {
  logger.error({ err }, `application ${type}`)

  Promise.race([app?.stop(), sleep(1000, 'timeout', { ref: false })])
    .catch()
    .finally(() => {
      process.exit(1)
    })
}

function createLogger () {
  const destination = new MessagePortWritable({ port: workerData.loggingPort })
  const logger = pino({ level: 'trace' }, destination)

  // Forward stdio as well via the destination
  const originalStdoutWrite = process.stdout.write.bind(process.stdout)
  const originalStderrWrite = process.stderr.write.bind(process.stderr)

  process.stdout.write = function (chunk, encoding, callback) {
    for (const line of chunk.trimEnd().split('\n')) {
      logger.info({ raw: line })
    }

    return originalStdoutWrite(chunk, encoding, callback)
  }

  process.stderr.write = function (chunk, encoding, callback) {
    for (const line of chunk.trimEnd().split('\n')) {
      logger.error({ raw: line })
    }

    return originalStderrWrite(chunk, encoding, callback)
  }

  return logger
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
    interceptors,
  }).compose(composedInterceptors)

  setGlobalDispatcher(globalDispatcher)

  // Setup mesh networker
  const threadDispatcher = wire({ port: parentPort, useNetwork: service.useHttp })

  // If the service is an entrypoint and runtime server config is defined, use it.
  let serverConfig = null
  if (config.server && service.entrypoint) {
    serverConfig = config.server
  } else if (service.useHttp) {
    serverConfig = {
      port: 0,
      host: '127.0.0.1',
      keepAliveTimeout: 5000,
    }
  }

  // Create the application
  app = new PlatformaticApp(
    service,
    logger,
    config.telemetry,
    serverConfig,
    !!config.managementApi,
    !!config.watch,
    config.metrics
  )

  // Setup interaction with parent port
  const itc = setupITC(app, service, threadDispatcher)

  // Get the dependencies
  const dependencies = config.autoload ? await app.getBootstrapDependencies() : []
  itc.notify('init', { dependencies })
  itc.listen()

  globalThis[kITC] = itc
}

// No need to catch this because there is the unhadledRejection handler on top.
main()

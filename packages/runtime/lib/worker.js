'use strict'

const inspector = require('node:inspector')
const { register, createRequire } = require('node:module')
const { isatty } = require('node:tty')
const { pathToFileURL } = require('node:url')
const { join } = require('node:path')
const {
  MessageChannel,
  parentPort,
  workerData
} = require('node:worker_threads')
const undici = require('undici')
const pino = require('pino')
const pretty = require('pino-pretty')
const { setGlobalDispatcher, Agent } = require('undici')
const RuntimeApi = require('./api')
const { MessagePortWritable } = require('./message-port-writable')
let loaderPort

if (typeof register === 'function' && workerData.config.loaderFile) {
  const { port1, port2 } = new MessageChannel()
  register(workerData.config.loaderFile, {
    data: { port: port2 },
    transferList: [port2]
  })
  loaderPort = port1
} else if (globalThis.LOADER_PORT) {
  loaderPort = globalThis.LOADER_PORT
  delete globalThis.LOADER_PORT
}

globalThis.fetch = undici.fetch

const config = workerData.config

let loggerConfig = config.server?.logger

if (loggerConfig) {
  loggerConfig = { ...loggerConfig }
} else {
  loggerConfig = {}
}

const cliStream = isatty(1) ? pretty() : pino.destination(1)

let logger = null
if (config.loggingPort) {
  const portStream = new MessagePortWritable({
    metadata: config.loggingMetadata,
    port: config.loggingPort
  })
  const multiStream = pino.multistream([
    { stream: portStream, level: 'trace' },
    { stream: cliStream, level: loggerConfig.level || 'info' }
  ])
  if (loggerConfig.transport) {
    const transport = pino.transport(loggerConfig.transport)
    multiStream.add({ level: loggerConfig.level || 'info', stream: transport })
  }
  logger = pino({ level: 'trace' }, multiStream)
} else {
  logger = pino(loggerConfig, cliStream)
}

if (config.server) {
  config.server.logger = logger
}

let stop

/* c8 ignore next 4 */
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'runtime uncaught exception')

  if (stop) {
    stop().then(() => {
      process.exit(1)
    })
  } else {
    process.exit(1)
  }
})

// Tested by test/cli/start.test.mjs by C8 does not see it.
/* c8 ignore next 4 */
process.on('unhandledRejection', (err) => {
  logger.error({ err }, 'runtime unhandled rejection')

  if (stop) {
    stop().then(() => {
      process.exit(1)
    })
  } else {
    process.exit(1)
  }
})

async function loadInterceptor (_require, module, options) {
  const url = pathToFileURL(_require.resolve(module))
  const interceptor = (await import(url)).default
  return interceptor(options)
}

function loadInterceptors (_require, interceptors) {
  return Promise.all(interceptors.map(async ({ module, options }) => {
    return loadInterceptor(_require, module, options)
  }))
}

async function main () {
  const { inspectorOptions } = workerData.config

  if (inspectorOptions) {
    /* c8 ignore next 6 */
    if (inspectorOptions.hotReloadDisabled) {
      logger.info('debugging flags were detected. hot reloading has been disabled')
    }

    inspector.open(inspectorOptions.port, inspectorOptions.host, inspectorOptions.breakFirstLine)
  }

  const interceptors = {}

  if (config.undici?.interceptors) {
    const _require = createRequire(join(workerData.dirname, 'package.json'))
    for (const key of ['Agent', 'Pool', 'Client']) {
      if (config.undici.interceptors[key]) {
        interceptors[key] = await loadInterceptors(_require, config.undici.interceptors[key])
      }
    }
  }

  const globalDispatcher = new Agent({
    ...config.undici,
    interceptors
  })
  setGlobalDispatcher(globalDispatcher)

  const runtime = new RuntimeApi(workerData.config, logger, loaderPort)
  runtime.startListening(parentPort)

  parentPort.postMessage('plt:init')

  let stopping = false

  stop = async function () {
    if (stopping) {
      return
    }

    stopping = true
    try {
      await runtime.stopServices()
    } catch (err) {
      logger.error({ err }, 'error while stopping services')
    }
  }
}

// No need to catch this because there is the unhadledRejection handler on top.
main()

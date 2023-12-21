'use strict'

const inspector = require('node:inspector')
const { register } = require('node:module')
const { isatty } = require('node:tty')
const {
  MessageChannel,
  parentPort,
  workerData
} = require('node:worker_threads')
const undici = require('undici')
const pino = require('pino')
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
let destination

if (loggerConfig) {
  loggerConfig = { ...loggerConfig }
} else {
  loggerConfig = {}
}

/* c8 ignore next 10 */
if (config.loggingPort) {
  destination = new MessagePortWritable({
    metadata: config.loggingMetadata,
    port: config.loggingPort
  })
  delete loggerConfig.transport
} else if (!loggerConfig.transport && isatty(1)) {
  loggerConfig.transport = {
    target: 'pino-pretty'
  }
}

const logger = pino(loggerConfig, destination)

if (config.server) {
  config.server.logger = logger
}

function main () {
  const { inspectorOptions } = workerData.config

  if (inspectorOptions) {
    /* c8 ignore next 6 */
    if (inspectorOptions.hotReloadDisabled) {
      logger.info('debugging flags were detected. hot reloading has been disabled')
    }

    inspector.open(inspectorOptions.port, inspectorOptions.host, inspectorOptions.breakFirstLine)
  }

  const runtime = new RuntimeApi(workerData.config, logger, loaderPort)
  runtime.startListening(parentPort)

  parentPort.postMessage('plt:init')

  let stopping = false

  async function stop () {
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

  /* c8 ignore next 4 */
  process.on('uncaughtException', (err) => {
    logger.error({ err }, 'runtime error')
    stop().then(() => {
      process.exit(1)
    })
  })

  // Tested by test/cli/start.test.mjs by C8 does not see it.
  /* c8 ignore next 4 */
  process.on('unhandledRejection', (err) => {
    logger.error({ err }, 'runtime error')
    stop().then(() => {
      process.exit(1)
    })
  })
}

main()

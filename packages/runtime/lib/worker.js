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

let transport
let destination

/* c8 ignore next 10 */
if (workerData.config.loggingPort) {
  destination = new MessagePortWritable({
    metadata: workerData.config.loggingMetadata,
    port: workerData.config.loggingPort
  })
} else if (isatty(1)) {
  transport = pino.transport({
    target: 'pino-pretty'
  })
}

const logger = pino(transport, destination)

/* c8 ignore next 4 */
process.once('uncaughtException', (err) => {
  logger.error({ err }, 'runtime error')
  setImmediate(() => {
    process.exit(1)
  })
})

// Tested by test/cli/start.test.mjs by C8 does not see it.
/* c8 ignore next 4 */
process.once('unhandledRejection', (err) => {
  logger.error({ err }, 'runtime error')
  setImmediate(() => {
    process.exit(1)
  })
})

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
}

main()

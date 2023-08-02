'use strict'

const inspector = require('node:inspector')
const { isatty } = require('node:tty')
const { parentPort, workerData } = require('node:worker_threads')
const undici = require('undici')
const pino = require('pino')
const RuntimeApi = require('./api')
const { MessagePortWritable } = require('./message-port-writable')
const loaderPort = globalThis.LOADER_PORT // Added by loader.mjs.

globalThis.fetch = undici.fetch
delete globalThis.LOADER_PORT

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
  throw err
})

// Tested by test/cli/start.test.mjs by C8 does not see it.
/* c8 ignore next 4 */
process.once('unhandledRejection', (err) => {
  logger.error({ err }, 'runtime error')
  throw err
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

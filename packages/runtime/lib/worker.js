'use strict'

const inspector = require('node:inspector')
const { parentPort, workerData } = require('node:worker_threads')
const undici = require('undici')
const RuntimeApi = require('./api')
const loaderPort = globalThis.LOADER_PORT // Added by loader.mjs.
const pino = require('pino')
const { isatty } = require('tty')

globalThis.fetch = undici.fetch
delete globalThis.LOADER_PORT

let transport

/* c8 ignore next 5 */
if (isatty(1)) {
  transport = pino.transport({
    target: 'pino-pretty'
  })
}

const logger = pino(transport)

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
    /* c8 ignore next 3 */
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

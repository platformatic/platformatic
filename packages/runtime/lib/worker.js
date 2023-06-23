'use strict'

const { parentPort, workerData } = require('node:worker_threads')
const RuntimeApi = require('./api')

const loaderPort = globalThis.LOADER_PORT // Added by loader.mjs.
const pino = require('pino')
const { isatty } = require('tty')

delete globalThis.LOADER_PORT

let transport

/* c8 ignore next 5 */
if (isatty(1)) {
  transport = pino.transport({
    target: 'pino-pretty'
  })
}

const logger = pino(transport)

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
  const runtime = new RuntimeApi(workerData.config, logger, loaderPort)
  runtime.startListening(parentPort)

  parentPort.postMessage('plt:init')
}

main()

'use strict'

const { parentPort, workerData } = require('node:worker_threads')
const FastifyUndiciDispatcher = require('fastify-undici-dispatcher')
const { Agent, setGlobalDispatcher } = require('undici')
const { PlatformaticApp } = require('./app')
const { RuntimeApi } = require('./api')

const loaderPort = globalThis.LOADER_PORT // Added by loader.mjs.
const globalAgent = new Agent()
const globalDispatcher = new FastifyUndiciDispatcher({
  dispatcher: globalAgent,
  // setting the domain here allows for fail-fast scenarios
  domain: '.plt.local'
})
const pino = require('pino')
const { isatty } = require('tty')

const applications = new Map()

delete globalThis.LOADER_PORT
setGlobalDispatcher(globalDispatcher)

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

async function main () {
  const { services } = workerData.config

  for (let i = 0; i < services.length; ++i) {
    const service = services[i]
    const app = new PlatformaticApp(service, loaderPort, logger)

    applications.set(service.id, app)
  }

  const runtime = new RuntimeApi(applications, globalDispatcher)
  runtime.startListening(parentPort)

  parentPort.postMessage('plt:init')
}

main()

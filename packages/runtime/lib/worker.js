'use strict'
const { parentPort, workerData } = require('node:worker_threads')
const FastifyUndiciDispatcher = require('fastify-undici-dispatcher')
const { Agent, setGlobalDispatcher } = require('undici')
const { PlatformaticApp } = require('./app')
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
let entrypoint

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

parentPort.on('message', async (msg) => {
  for (const app of applications.values()) {
    await app.handleProcessLevelEvent(msg)

    if (msg?.msg === 'plt:start' || msg?.msg === 'plt:restart') {
      const serviceUrl = new URL(app.appConfig.localUrl)

      globalDispatcher.route(serviceUrl.host, app.server)
    }
  }

  switch (msg?.msg) {
    case 'plt:start':
      configureDispatcher()
      parentPort.postMessage({ msg: 'plt:started', url: entrypoint.server.url })
      break
    case 'plt:restart':
      configureDispatcher()
      parentPort.postMessage({ msg: 'plt:restarted', url: entrypoint.server.url })
      break
    case 'plt:stop':
      process.exit() // Exit the worker thread.
      break
      /* c8 ignore next 3 */
    case undefined:
      // Ignore
      break
    default:
      throw new Error(`unknown message type: '${msg.msg}'`)
  }
})

async function main () {
  const { services } = workerData.config

  for (let i = 0; i < services.length; ++i) {
    const service = services[i]
    const app = new PlatformaticApp(service, loaderPort, logger)

    applications.set(service.id, app)

    if (service.entrypoint) {
      entrypoint = app
    }
  }

  parentPort.postMessage('plt:init')
}

function configureDispatcher () {
  const { services } = workerData.config

  // Setup the local services in the global dispatcher.
  for (let i = 0; i < services.length; ++i) {
    const service = services[i]
    const serviceApp = applications.get(service.id)
    const serviceUrl = new URL(service.localUrl)

    globalDispatcher.route(serviceUrl.host, serviceApp.server)

    for (let j = 0; j < service.dependencies.length; ++j) {
      const depConfig = service.dependencies[j]
      const depApp = applications.get(depConfig.id)
      const depUrl = new URL(depConfig.url)

      globalDispatcher.route(depUrl.host, depApp.server)
    }
  }
}

main()

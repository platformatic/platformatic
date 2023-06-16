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
  const message = msg?.msg
  if (message) {
    await executeCommand(message, msg.params)
    return
  }

  for (const app of applications.values()) {
    await app.handleProcessLevelEvent(msg)
  }
})

async function executeCommand (command, params) {
  if (command === undefined) return

  if (command === 'plt:start') {
    await startServices()
    configureDispatcher()
    parentPort.postMessage({ msg: 'plt:started', url: entrypoint.server.url })
    return
  }
  if (command === 'plt:restart') {
    await restartServices()
    configureDispatcher()
    parentPort.postMessage({ msg: 'plt:restarted', url: entrypoint.server.url })
    return
  }
  if (command === 'plt:stop') {
    await stopServices()
    process.exit() // Exit the worker thread.
  }
  if (command === 'plt:get-status') {
    const serviceId = params.id
    const res = getServiceStatus(serviceId)

    parentPort.postMessage({
      msg: 'plt:service-status',
      id: serviceId,
      res: JSON.stringify(res)
    })
    return
  }
  if (command === 'plt:get-config') {
    const serviceId = params.id
    const res = getServiceConfig(serviceId)

    parentPort.postMessage({
      msg: 'plt:service-config',
      id: serviceId,
      res: JSON.stringify(res)
    })
    return
  }
  if (command === 'plt:start-service') {
    const serviceId = params.id
    const res = await startService(serviceId)

    parentPort.postMessage({
      msg: 'plt:service-started',
      id: serviceId,
      res: JSON.stringify(res)
    })
    return
  }
  if (command === 'plt:stop-service') {
    const serviceId = params.id
    const res = await stopService(serviceId)

    parentPort.postMessage({
      msg: 'plt:service-stopped',
      id: serviceId,
      res: JSON.stringify(res)
    })
    return
  }
  if (command === 'plt:get-topology') {
    const topology = getServicesTopology()

    parentPort.postMessage({
      msg: 'plt:service-stopped',
      res: JSON.stringify(topology)
    })
    return
  }
  throw new Error(`unknown message type: '${command}'`)
}

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

async function startServices () {
  for (const app of applications.values()) {
    await app.start()

    const serviceUrl = new URL(app.appConfig.localUrl)
    globalDispatcher.route(serviceUrl.host, app.server)
  }
}

async function stopServices () {
  for (const app of applications.values()) {
    if (!app.server) continue
    await app.stop()
  }
}

async function restartServices () {
  for (const app of applications.values()) {
    if (!app.server) continue
    await app.restart(true)

    const serviceUrl = new URL(app.appConfig.localUrl)
    globalDispatcher.route(serviceUrl.host, app.server)
  }
}

function getServiceStatus (id) {
  const application = applications.get(id)

  if (!application) {
    return {
      code: 'APPLICATION_NOT_FOUND',
      error: `Application with id '${id}' not found`
    }
  }

  return application.getStatus()
}

function getServiceConfig (id) {
  const application = applications.get(id)

  if (!application) {
    return {
      code: 'APPLICATION_NOT_FOUND',
      error: `Application with id '${id}' not found`
    }
  }

  const { config } = application
  if (!config) {
    return {
      code: 'APPLICATION_NOT_STARTED',
      error: `Application with id '${id}' has not been started`
    }
  }

  return config.configManager.current
}

async function startService (id) {
  const application = applications.get(id)

  if (!application) {
    return {
      code: 'APPLICATION_NOT_FOUND',
      error: `Application with id '${id}' not found`
    }
  }

  try {
    await application.start()
  } catch (err) {
    return {
      code: 'APPLICATION_START_FAILED',
      error: `Application with id '${id}' failed to start: ${err.message}`
    }
  }
}

async function stopService (id) {
  const application = applications.get(id)

  if (!application) {
    return {
      code: 'APPLICATION_NOT_FOUND',
      error: `Application with id '${id}' not found`
    }
  }

  try {
    await application.stop()
  } catch (err) {
    return {
      code: 'APPLICATION_STOP_FAILED',
      error: `Application with id '${id}' failed to stop: ${err.message}`
    }
  }
}

function getServicesTopology () {
  const topology = { services: [] }

  for (const app of applications.values()) {
    const { id, entrypoint, dependencies } = app.appConfig
    if (entrypoint) {
      topology.entrypoint = id
    }
    topology.services.push({ id, dependencies })
  }

  return topology
}

main()

'use strict'
const { once } = require('node:events')
const inspector = require('node:inspector')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')
const { Worker } = require('node:worker_threads')
const closeWithGrace = require('close-with-grace')
const { loadConfig } = require('@platformatic/config')
const { parseInspectorOptions, platformaticRuntime } = require('./config')
const RuntimeApiClient = require('./api-client.js')
const kLoaderFile = pathToFileURL(join(__dirname, 'loader.mjs')).href
const kWorkerFile = join(__dirname, 'worker.js')
const kWorkerExecArgv = [
  '--no-warnings',
  '--experimental-loader',
  kLoaderFile
]

async function start (argv) {
  const config = await loadConfig({}, argv, platformaticRuntime, {
    watch: true
  })

  config.configManager.args = config.args
  const app = await startWithConfig(config.configManager)
  await app.start()
  return app
}

async function startWithConfig (configManager, env = process.env) {
  const config = configManager.current

  if (inspector.url()) {
    throw new Error('The Node.js inspector flags are not supported. Please use \'platformatic start --inspect\' instead.')
  }

  if (configManager.args) {
    parseInspectorOptions(configManager)
  }

  const worker = new Worker(kWorkerFile, {
    /* c8 ignore next */
    execArgv: config.hotReload ? kWorkerExecArgv : [],
    transferList: config.loggingPort ? [config.loggingPort] : [],
    workerData: { config },
    env
  })

  let exited = null
  worker.on('exit', () => {
    configManager.fileWatcher?.stopWatching()
    if (typeof exited === 'function') {
      exited()
    }
  })

  worker.on('error', () => {
    // If this is the only 'error' handler, then exit the process as the default
    // behavior. If anything else is listening for errors, then don't exit.
    if (worker.listenerCount('error') === 1) {
      // The error is logged in the worker.
      process.exit(1)
    }
  })

  if (config.hotReload) {
    /* c8 ignore next 3 */
    process.on('SIGUSR2', () => {
      worker.postMessage({ signal: 'SIGUSR2' })
    })

    closeWithGrace((event, cb) => {
      worker.postMessage(event)
      exited = cb
    })

    /* c8 ignore next 3 */
    configManager.on('update', () => {
      // TODO(cjihrig): Need to clean up and restart the worker.
    })
  }

  await once(worker, 'message') // plt:init

  const runtimeApiClient = new RuntimeApiClient(worker)
  return runtimeApiClient
}

module.exports = { start, startWithConfig }

'use strict'
const { once } = require('node:events')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')
const { Worker } = require('node:worker_threads')
const closeWithGrace = require('close-with-grace')
const { loadConfig } = require('@platformatic/service')
const { platformaticRuntime } = require('./config')
const { RuntimeApiClient } = require('./api.js')
const kLoaderFile = pathToFileURL(join(__dirname, 'loader.mjs')).href
const kWorkerFile = join(__dirname, 'worker.js')
const kWorkerExecArgv = [
  '--no-warnings',
  '--experimental-loader',
  kLoaderFile
]

async function start (argv) {
  const { configManager } = await loadConfig({}, argv, platformaticRuntime, {
    watch: true
  })
  const app = await startWithConfig(configManager)

  await app.start()
  return app
}

async function startWithConfig (configManager) {
  const config = configManager.current
  const worker = new Worker(kWorkerFile, {
    /* c8 ignore next */
    execArgv: config.hotReload ? kWorkerExecArgv : [],
    workerData: { config }
  })

  worker.on('exit', () => {
    configManager.fileWatcher?.stopWatching()
  })

  worker.on('error', () => {
    // the error is logged in the worker
    process.exit(1)
  })

  /* c8 ignore next 3 */
  process.on('SIGUSR2', () => {
    worker.postMessage({ signal: 'SIGUSR2' })
  })

  closeWithGrace((event) => {
    worker.postMessage(event)
  })

  /* c8 ignore next 3 */
  configManager.on('update', () => {
    // TODO(cjihrig): Need to clean up and restart the worker.
  })

  await once(worker, 'message') // plt:init

  const runtimeApiClient = new RuntimeApiClient(worker)
  return runtimeApiClient
}

module.exports = { start, startWithConfig }

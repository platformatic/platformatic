'use strict'
const { once } = require('node:events')
const inspector = require('node:inspector')
const { join } = require('node:path')
const { pathToFileURL } = require('node:url')
const { Worker } = require('node:worker_threads')
const closeWithGrace = require('close-with-grace')
const { start: serviceStart } = require('@platformatic/service')
const { loadConfig } = require('./load-config')
const { parseInspectorOptions, wrapConfigInRuntimeConfig } = require('./config')
const RuntimeApiClient = require('./api-client.js')
const { printConfigValidationErrors } = require('@platformatic/config')
const errors = require('./errors')

const kLoaderFile = pathToFileURL(join(__dirname, 'loader.mjs')).href
const kWorkerFile = join(__dirname, 'worker.js')
const kWorkerExecArgv = [
  '--no-warnings',
  '--experimental-loader',
  kLoaderFile
]

async function startWithConfig (configManager, env = process.env) {
  const config = configManager.current

  if (inspector.url()) {
    throw new errors.NodeInspectorFlagsNotSupportedError()
  }

  if (configManager.args) {
    parseInspectorOptions(configManager)
  }

  if (config.hotReload) {
    config.loaderFile = kLoaderFile
  }
  // The configManager cannot be transferred to the worker, so remove it.
  delete config.configManager

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

async function start (args) {
  const config = await loadConfig({}, args)

  if (config.configType === 'runtime') {
    config.configManager.args = config.args
    const app = await startWithConfig(config.configManager)
    await app.start()
    return app
  }

  return serviceStart(config.app, args)
}

async function startCommand (args) {
  try {
    // adds default allow env vars to runtime
    if (!args.includes('--allow-env')) {
      args.push('--allow-env', 'PORT,HOSTNAME,DATABASE_URL')
    }
    const config = await loadConfig({}, args)
    let runtime

    if (config.configType === 'runtime') {
      config.configManager.args = config.args
      runtime = await startWithConfig(config.configManager)
    } else {
      const wrappedConfig = await wrapConfigInRuntimeConfig(config)
      wrappedConfig.args = config.args
      runtime = await startWithConfig(wrappedConfig)
    }

    return await runtime.start()
  } catch (err) {
    logErrorAndExit(err)
  }
}

function logErrorAndExit (err) {
  if (err.filenames) {
    console.error(`Missing config file!
Be sure to have a config file with one of the following names:

${err.filenames.map((s) => ' * ' + s).join('\n')}

In alternative run "npm create platformatic@latest" to generate a basic plt service config.`)
    process.exit(1)
  } else if (err.validationErrors) {
    printConfigValidationErrors(err)
    process.exit(1)
  }

  delete err?.stack
  console.error(err?.message)

  if (err?.cause) {
    console.error(`${err.cause}`)
  }

  process.exit(1)
}

module.exports = { start, startWithConfig, startCommand }

'use strict'

const { once } = require('node:events')
const inspector = require('node:inspector')
const { join, resolve, dirname } = require('node:path')
const { writeFile } = require('node:fs/promises')
const { setTimeout: sleep } = require('node:timers/promises')
const { pathToFileURL } = require('node:url')
const { Worker } = require('node:worker_threads')
const { start: serviceStart } = require('@platformatic/service')
const { printConfigValidationErrors } = require('@platformatic/config')
const closeWithGrace = require('close-with-grace')
const { loadConfig } = require('./load-config')
const { startManagementApi } = require('./management-api')
const { startPrometheusServer } = require('./prom-server.js')
const { WorkerExitCodeError } = require('./errors')
const { parseInspectorOptions, wrapConfigInRuntimeConfig } = require('./config')
const { RuntimeApiClient, getRuntimeLogsDir } = require('./api-client.js')
const errors = require('./errors')
const pkg = require('../package.json')

const kLoaderFile = pathToFileURL(join(__dirname, 'loader.mjs')).href
const kWorkerFile = join(__dirname, 'worker.js')
const kWorkerExecArgv = [
  '--no-warnings',
  '--experimental-loader',
  kLoaderFile
]

function startWorker ({ config, dirname, runtimeLogsDir }, env) {
  const worker = new Worker(kWorkerFile, {
    /* c8 ignore next */
    execArgv: config.hotReload ? kWorkerExecArgv : [],
    transferList: config.loggingPort ? [config.loggingPort] : [],
    workerData: { config, dirname, runtimeLogsDir },
    env
  })

  return worker
}

async function buildRuntime (configManager, env = process.env) {
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

  const dirname = configManager.dirname
  const runtimeLogsDir = getRuntimeLogsDir(dirname, process.pid)

  // The configManager cannot be transferred to the worker, so remove it.
  delete config.configManager

  let worker = startWorker({ config, dirname, runtimeLogsDir }, env)

  let managementApi = null

  let exiting = false
  closeWithGrace((event, cb) => {
    exiting = true
    worker.postMessage(event)
    worker.once('exit', (code) => {
      if (code !== 0) {
        cb(new WorkerExitCodeError(code))
        return
      }
      cb()
    })
  })

  if (config.hotReload) {
    /* c8 ignore next 3 */
    process.on('SIGUSR2', () => {
      worker.postMessage({ signal: 'SIGUSR2' })
    })

    /* c8 ignore next 3 */
    configManager.on('update', () => {
      // TODO(cjihrig): Need to clean up and restart the worker.
    })
  }

  function setupExit () {
    worker.on('exit', (code) => {
      // runtimeApiClient.started can be false if a stop command was issued
      // via the management API.
      if (exiting || !runtimeApiClient.started) {
        // We must stop those here in case the `closeWithGrace` callback
        // was not called.
        configManager.fileWatcher?.stopWatching()
        managementApi?.close()
        return
      }

      worker = startWorker({ config, dirname, runtimeLogsDir }, env)
      setupExit()
      once(worker, 'message').then(() => {
        runtimeApiClient.setWorker(worker)
      })
    })
  }

  setupExit()

  await once(worker, 'message') // plt:init

  const runtimeApiClient = new RuntimeApiClient(
    worker,
    configManager,
    runtimeLogsDir
  )

  if (config.managementApi) {
    managementApi = await startManagementApi(runtimeApiClient, configManager)
    runtimeApiClient.managementApi = managementApi
    runtimeApiClient.on('start', () => {
      runtimeApiClient.startCollectingMetrics()
    })
  }
  if (config.metrics) {
    runtimeApiClient.on('start', async () => {
      await startPrometheusServer(runtimeApiClient, config.metrics)
    })
  }

  return runtimeApiClient
}

async function start (args) {
  const config = await loadConfig({}, args)

  if (config.configType === 'runtime') {
    config.configManager.args = config.args
    const app = await buildRuntime(config.configManager)
    await app.start()
    return app
  }

  return serviceStart(config.app, args)
}

async function startCommand (args) {
  try {
    const config = await loadConfig({}, args)
    let runtime

    if (config.configType === 'runtime') {
      config.configManager.args = config.args
      runtime = await buildRuntime(config.configManager)
    } else {
      const wrappedConfig = await wrapConfigInRuntimeConfig(config)
      wrappedConfig.args = config.args
      runtime = await buildRuntime(wrappedConfig)
    }

    return await runtime.start()
  } catch (err) {
    if (err.code === 'PLT_CONFIG_NO_CONFIG_FILE_FOUND' && args.length === 1) {
      const config = {
        $schema: `https://platformatic.dev/schemas/v${pkg.version}/service`,
        server: {
          hostname: '127.0.0.1',
          port: 3042,
          logger: {
            level: 'info'
          }
        },
        plugins: {
          paths: [args[0]]
        },
        service: {
          openapi: true
        },
        watch: true
      }
      const toWrite = join(dirname(resolve(args[0])), 'platformatic.service.json')
      console.log(`No config file found, creating ${join(dirname(args[0]), 'platformatic.service.json')}`)
      await writeFile(toWrite, JSON.stringify(config, null, 2))
      return startCommand(['--config', toWrite])
    }

    if (err.code === 'PLT_RUNTIME_RUNTIME_EXIT') {
      console.log('Runtime exited before startup was completed, restarting')
      await sleep(1000)
      return startCommand(args)
    }

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
}

module.exports = { buildRuntime, start, startCommand }

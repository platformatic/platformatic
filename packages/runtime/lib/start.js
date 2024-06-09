'use strict'

const { once } = require('node:events')
const inspector = require('node:inspector')
const { join, resolve, dirname } = require('node:path')
const { writeFile } = require('node:fs/promises')
const { pathToFileURL } = require('node:url')
const { Worker } = require('node:worker_threads')
const { start: serviceStart } = require('@platformatic/service')
const { printConfigValidationErrors } = require('@platformatic/config')
const closeWithGrace = require('close-with-grace')
const { loadConfig } = require('./load-config')
const { startManagementApi } = require('./management-api')
const { startPrometheusServer } = require('./prom-server.js')
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

async function buildRuntime (configManager, env) {
  env = env || process.env
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
      if (config.restartOnError === false || !runtimeApiClient.started) {
        // We must stop those here in case the `closeWithGrace` callback
        // was not called.
        configManager.fileWatcher?.stopWatching()
        managementApi?.close()
        return
      }

      worker = startWorker({ config, dirname, runtimeLogsDir }, env)
      setupExit()

      once(worker, 'message').then((msg) => {
        runtimeApiClient.setWorker(worker).catch(() => {
          // TODO: currently we restart if the worker fails to start intermitently
          // should we limit this to a number of retries?
        })
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

async function setupAndStartRuntime (config) {
  const MAX_PORT = 65535
  let runtimeConfig

  if (config.configType === 'runtime') {
    config.configManager.args = config.args
    runtimeConfig = config.configManager
  } else {
    const wrappedConfig = await wrapConfigInRuntimeConfig(config)
    wrappedConfig.args = config.args
    runtimeConfig = wrappedConfig
  }

  let runtime = await buildRuntime(runtimeConfig)

  let address = null

  while (address === null) {
    try {
      address = await runtime.start()
    } catch (err) {
      if (err.code === 'PLT_RUNTIME_EADDR_IN_USE') {
        if (runtimeConfig.current.server.port > MAX_PORT) {
          throw err
        }
        runtimeConfig.current.server.port++
        runtime = await buildRuntime(runtimeConfig)
      }
    }
  }

  return { address, runtime }
}

async function startCommand (args) {
  try {
    const config = await loadConfig({}, args)

    const startResult = await setupAndStartRuntime(config)

    const runtime = startResult.runtime
    const res = startResult.address

    closeWithGrace(async (event) => {
      if (event.err instanceof Error) {
        console.error(event.err)
      }
      await runtime.close()
    })

    return res
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

    console.error(err)

    process.exit(1)
  }
}

module.exports = { buildRuntime, start, startCommand }

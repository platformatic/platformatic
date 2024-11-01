import { collectMetrics } from '@platformatic/metrics'
import { deepmerge, executeWithTimeout } from '@platformatic/utils'
import { parseCommandString } from 'execa'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { hostname, platform } from 'node:os'
import { pathToFileURL } from 'node:url'
import { workerData } from 'node:worker_threads'
import pino from 'pino'
import split2 from 'split2'
import { NonZeroExitCode } from './errors.js'
import { cleanBasePath } from './utils.js'
import { ChildManager } from './worker/child-manager.js'

export class BaseStackable {
  childManager
  #subprocess
  #subprocessStarted

  constructor (type, version, options, root, configManager) {
    options.context.worker ??= { count: 1, index: 0 }

    this.type = type
    this.version = version
    this.serviceId = options.context.serviceId
    this.workerId = options.context.worker.count > 1 ? options.context.worker.index : undefined
    this.telemetryConfig = options.context.telemetryConfig
    this.options = options
    this.root = root
    this.configManager = configManager
    this.serverConfig = deepmerge(options.context.serverConfig ?? {}, configManager.current.server ?? {})
    this.openapiSchema = null
    this.graphqlSchema = null
    this.isEntrypoint = options.context.isEntrypoint
    this.isProduction = options.context.isProduction
    this.metricsRegistry = null
    this.startHttpTimer = null
    this.endHttpTimer = null
    this.clientWs = null
    this.runtimeConfig = workerData?.config ?? null

    // Setup the logger
    const pinoOptions = {
      level: this.configManager.current?.logger?.level ?? this.serverConfig?.logger?.level ?? 'trace'
    }

    if (this.serviceId) {
      pinoOptions.name = this.serviceId
    }

    if (typeof options.context.worker?.index !== 'undefined') {
      pinoOptions.base = { pid: process.pid, hostname: hostname(), worker: this.workerId }
    }

    this.logger = pino(pinoOptions)

    // Setup globals
    this.registerGlobals({
      serviceId: this.serviceId,
      workerId: this.workerId,
      logLevel: this.logger.level,
      // Always use URL to avoid serialization problem in Windows
      root: pathToFileURL(this.root).toString(),
      setOpenapiSchema: this.setOpenapiSchema.bind(this),
      setGraphqlSchema: this.setGraphqlSchema.bind(this),
      setBasePath: this.setBasePath.bind(this)
    })
  }

  getUrl () {
    return this.url
  }

  async getConfig () {
    return this.configManager.current
  }

  async getEnv () {
    return this.configManager.env
  }

  async getWatchConfig () {
    const config = this.configManager.current

    const enabled = config.watch?.enabled !== false

    if (!enabled) {
      return { enabled, path: this.root }
    }

    return {
      enabled,
      path: this.root,
      allow: config.watch?.allow,
      ignore: config.watch?.ignore
    }
  }

  async getInfo () {
    return { type: this.type, version: this.version }
  }

  getDispatchFunc () {
    return this
  }

  async getOpenapiSchema () {
    return this.openapiSchema
  }

  async getGraphqlSchema () {
    return this.graphqlSchema
  }

  setOpenapiSchema (schema) {
    this.openapiSchema = schema
  }

  setGraphqlSchema (schema) {
    this.graphqlSchema = schema
  }

  setBasePath (basePath) {
    this.basePath = basePath
  }

  async log ({ message, level }) {
    const logLevel = level ?? 'info'
    this.logger[logLevel](message)
  }

  registerGlobals (globals) {
    globalThis.platformatic = Object.assign(globalThis.platformatic ?? {}, globals)
  }

  verifyOutputDirectory (path) {
    if (this.isProduction && !existsSync(path)) {
      throw new Error(
        `Cannot access directory '${path}'. Please run the 'build' command before running in production mode.`
      )
    }
  }

  async buildWithCommand (command, basePath, loader, scripts) {
    if (Array.isArray(command)) {
      command = command.join(' ')
    }

    this.logger.debug(`Executing "${command}" ...`)

    const context = await this.#getChildManagerContext(basePath)
    this.childManager = new ChildManager({
      logger: this.logger,
      loader,
      scripts,
      context
    })

    try {
      await this.childManager.inject()

      const subprocess = this.spawn(command)

      // Wait for the process to be started
      await new Promise((resolve, reject) => {
        subprocess.on('spawn', resolve)
        subprocess.on('error', reject)
      })

      // Route anything not catched by child process logger to the logger manually
      /* c8 ignore next 3 */
      subprocess.stdout.pipe(split2()).on('data', line => {
        this.logger.info(line)
      })

      /* c8 ignore next 3 */
      subprocess.stderr.pipe(split2()).on('data', line => {
        this.logger.error(line)
      })

      const [exitCode] = await once(subprocess, 'exit')

      if (exitCode !== 0) {
        const error = new NonZeroExitCode(exitCode)
        error.exitCode = exitCode
        throw error
      }
    } finally {
      await this.childManager.eject()
      await this.childManager.close()
    }
  }

  async startWithCommand (command, loader) {
    const config = this.configManager.current
    const basePath = config.application?.basePath ? cleanBasePath(config.application?.basePath) : ''

    const context = await this.#getChildManagerContext(basePath)
    this.childManager = new ChildManager({
      logger: this.logger,
      loader,
      context
    })

    this.childManager.on('config', config => {
      this.subprocessConfig = config
    })

    try {
      await this.childManager.inject()

      this.subprocess = this.spawn(command)

      // Route anything not catched by child process logger to the logger manually
      /* c8 ignore next 3 */
      this.subprocess.stdout.pipe(split2()).on('data', line => {
        this.logger.info(line)
      })

      /* c8 ignore next 3 */
      this.subprocess.stderr.pipe(split2()).on('data', line => {
        this.logger.error(line)
      })

      // Wait for the process to be started
      await new Promise((resolve, reject) => {
        this.subprocess.on('spawn', resolve)
        this.subprocess.on('error', reject)
      })

      this.#subprocessStarted = true
    } catch (e) {
      this.childManager.close('SIGKILL')
      throw new Error(`Cannot execute command "${command}": executable not found`)
    } finally {
      await this.childManager.eject()
    }

    // If the process exits prematurely, terminate the thread with the same code
    this.subprocess.on('exit', code => {
      if (this.#subprocessStarted && typeof code === 'number' && code !== 0) {
        this.childManager.close('SIGKILL')
        process.exit(code)
      }
    })

    const [url, clientWs] = await once(this.childManager, 'url')
    this.url = url
    this.clientWs = clientWs
  }

  async stopCommand () {
    this.#subprocessStarted = false
    const exitPromise = once(this.subprocess, 'exit')

    // Attempt graceful close on the process
    this.childManager.notify(this.clientWs, 'close')

    // If the process hasn't exited in 10 seconds, kill it in the polite way
    /* c8 ignore next 10 */
    const res = await executeWithTimeout(exitPromise, 10000)
    if (res === 'timeout') {
      this.subprocess.kill(this.subprocessTerminationSignal ?? 'SIGINT')

      // If the process hasn't exited in 10 seconds, kill it the hard way
      const res = await executeWithTimeout(exitPromise, 10000)
      if (res === 'timeout') {
        this.subprocess.kill('SIGKILL')
      }
    }

    await exitPromise

    // Close the manager
    this.childManager.close()
  }

  getChildManager () {
    return this.childManager
  }

  spawn (command) {
    const [executable, ...args] = parseCommandString(command)

    /* c8 ignore next 3 */
    return platform() === 'win32'
      ? spawn(command, { cwd: this.root, shell: true, windowsVerbatimArguments: true })
      : spawn(executable, args, { cwd: this.root })
  }

  async collectMetrics () {
    let metricsConfig = this.options.context.metricsConfig
    if (metricsConfig !== false) {
      metricsConfig = {
        defaultMetrics: true,
        httpMetrics: true,
        ...metricsConfig
      }

      if (this.childManager && this.clientWs) {
        await this.childManager.send(this.clientWs, 'collectMetrics', {
          serviceId: this.serviceId,
          workerId: this.workerId,
          metricsConfig
        })
        return
      }

      const { registry, startHttpTimer, endHttpTimer } = await collectMetrics(
        this.serviceId,
        this.workerId,
        metricsConfig
      )

      this.metricsRegistry = registry
      this.startHttpTimer = startHttpTimer
      this.endHttpTimer = endHttpTimer
    }
  }

  async getMetrics ({ format } = {}) {
    if (this.childManager && this.clientWs) {
      return this.childManager.send(this.clientWs, 'getMetrics', { format })
    }

    if (!this.metricsRegistry) return null

    return format === 'json' ? await this.metricsRegistry.getMetricsAsJSON() : await this.metricsRegistry.metrics()
  }

  getMeta () {
    return {
      composer: {
        wantsAbsoluteUrls: false
      }
    }
  }

  async #getChildManagerContext (basePath) {
    const meta = await this.getMeta()

    return {
      id: this.id,
      serviceId: this.serviceId,
      workerId: this.workerId,
      // Always use URL to avoid serialization problem in Windows
      root: pathToFileURL(this.root).toString(),
      basePath,
      logLevel: this.logger.level,
      isEntrypoint: this.isEntrypoint,
      runtimeBasePath: this.runtimeConfig?.basePath ?? null,
      wantsAbsoluteUrls: meta.composer?.wantsAbsoluteUrls ?? false,
      /* c8 ignore next 2 */
      port: (this.isEntrypoint ? this.serverConfig?.port || 0 : undefined) ?? true,
      host: (this.isEntrypoint ? this.serverConfig?.hostname : undefined) ?? true,
      telemetry: this.telemetryConfig
    }
  }
}

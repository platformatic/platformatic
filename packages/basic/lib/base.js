import { executeCommand } from '@platformatic/utils'
import { parseCommandString } from 'execa'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { platform } from 'node:os'
import { pathToFileURL } from 'node:url'
import pino from 'pino'
import { cleanBasePath } from './utils.js'
import { ChildManager } from './worker/child-manager.js'

export class BaseStackable {
  #childManager
  #subprocess
  #subprocessStarted

  constructor (type, version, options, root, configManager) {
    this.type = type
    this.version = version
    this.id = options.context.serviceId
    this.options = options
    this.root = root
    this.configManager = configManager
    this.serverConfig = options.context.serverConfig
    this.openapiSchema = null
    this.getGraphqlSchema = null
    this.isEntrypoint = options.context.isEntrypoint
    this.isProduction = options.context.isProduction

    // Setup the logger
    const pinoOptions = {
      level: (this.configManager.current.server ?? this.serverConfig)?.logger?.level ?? 'trace'
    }

    if (this.id) {
      pinoOptions.name = this.id
    }
    this.logger = pino(pinoOptions)

    // Setup globals
    this.registerGlobals({
      setOpenapiSchema: this.setOpenapiSchema.bind(this),
      setGraphqlSchema: this.setGraphqlSchema.bind(this),
      setServicePrefix: this.setServicePrefix.bind(this)
    })
  }

  getUrl () {
    return this.url
  }

  async getConfig () {
    return this.configManager.current
  }

  async getWatchConfig () {
    const config = this.configManager.current

    const enabled = config.watch?.enabled !== false

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

  async collectMetrics () {
    return {
      defaultMetrics: true,
      httpMetrics: false
    }
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

  setServicePrefix (prefix) {
    this.servicePrefix = prefix
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

  async buildWithCommand (command, basePath, loader) {
    if (typeof command === 'string') {
      this.logger.debug(`Executing '${command}' ...`)
    } else {
      this.logger.debug(`Executing '${command.join(' ')}' ...`)
    }

    this.#childManager = new ChildManager({
      logger: this.logger,
      loader,
      skipProcessManager: true,
      context: {
        id: this.id,
        // Always use URL to avoid serialization problem in Windows
        root: pathToFileURL(this.root).toString(),
        basePath,
        logLevel: this.logger.level,
        port: (this.isEntrypoint ? this.serverConfig?.port || 0 : undefined) ?? true
      }
    })

    try {
      await this.#childManager.inject()

      const { exitCode } = await executeCommand(
        this.options.context.directory,
        command,
        this.logger,
        'Execution failed with exit code {EXIT_CODE}'
      )

      if (exitCode !== 0) {
        throw new Error(`Building failed with exit code ${exitCode}`)
      }
    } finally {
      await this.#childManager.eject()
      await this.#childManager.close()
    }
  }

  async startWithCommand (command, loader) {
    const config = this.configManager.current
    const basePath = config.application?.basePath ? cleanBasePath(config.application?.basePath) : ''

    this.#childManager = new ChildManager({
      logger: this.logger,
      loader,
      context: {
        id: this.id,
        // Always use URL to avoid serialization problem in Windows
        root: pathToFileURL(this.root).toString(),
        basePath,
        logLevel: this.logger.level,
        port: (this.isEntrypoint ? this.serverConfig?.port || 0 : undefined) ?? true
      }
    })

    this.#childManager.on('config', config => {
      this.subprocessConfig = config
    })

    try {
      const [executable, ...args] = parseCommandString(command)

      await this.#childManager.inject()

      this.subprocess =
        platform() === 'win32'
          ? spawn(command, { cwd: this.root, shell: true, windowsVerbatimArguments: true })
          : spawn(executable, args, { cwd: this.root })

      await new Promise((resolve, reject) => {
        this.subprocess.on('spawn', resolve)
        this.subprocess.on('error', reject)
      })

      this.#subprocessStarted = true
    } catch (e) {
      throw new Error(`Cannot execute command "${command}": executable not found`)
    } finally {
      await this.#childManager.eject()
    }

    // // If the process exits prematurely, terminate the thread with the same code
    this.subprocess.on('exit', code => {
      if (this.#subprocessStarted && typeof code === 'number' && code !== 0) {
        process.exit(code)
      }
    })

    const [url] = await once(this.#childManager, 'url')
    this.url = url
  }

  async stopCommand () {
    this.#subprocessStarted = false
    const exitPromise = once(this.subprocess, 'exit')

    this.#childManager.close(this.subprocessTerminationSignal ?? 'SIGINT')
    this.subprocess.kill(this.subprocessTerminationSignal ?? 'SIGINT')
    await exitPromise
  }
}

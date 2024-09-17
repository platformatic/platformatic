import deepmerge from '@fastify/deepmerge'
import { parseCommandString } from 'execa'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { platform } from 'node:os'
import { pathToFileURL } from 'node:url'
import pino from 'pino'
import split2 from 'split2'
import { NonZeroExitCode } from './errors.js'
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
    this.serverConfig = deepmerge(options.context.serverConfig, configManager.current.server)
    this.openapiSchema = null
    this.getGraphqlSchema = null
    this.isEntrypoint = options.context.isEntrypoint
    this.isProduction = options.context.isProduction

    // Setup the logger
    const pinoOptions = {
      level: this.serverConfig?.logger?.level ?? 'trace'
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
    if (Array.isArray(command)) {
      command = command.join(' ')
    }

    this.logger.debug(`Executing "${command}" ...`)

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

    try {
      await this.#childManager.inject()

      const subprocess = this.spawn(command)

      // Wait for the process to be started
      await new Promise((resolve, reject) => {
        subprocess.on('spawn', resolve)
        subprocess.on('error', reject)
      })

      // Route anything not catched by child process logger to the logger manually
      subprocess.stdout.pipe(split2()).on('data', line => {
        this.logger.info(line)
      })

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
      await this.#childManager.inject()

      this.subprocess = this.spawn(command)

      // Route anything not catched by child process logger to the logger manually
      this.subprocess.stdout.pipe(split2()).on('data', line => {
        this.logger.info(line)
      })

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

  spawn (command) {
    const [executable, ...args] = parseCommandString(command)

    return platform() === 'win32'
      ? spawn(command, { cwd: this.root, shell: true, windowsVerbatimArguments: true })
      : spawn(executable, args, { cwd: this.root })
  }
}

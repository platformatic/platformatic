import {
  BaseCapability,
  buildAdditionalServerOptions,
  cleanBasePath,
  createServerListener,
  ensureTrailingSlash,
  errors,
  getServerUrl,
  importFile,
  injectViaRequest,
  resolvePackageViaCJS
} from '@platformatic/basic'
import { hasDependency, sanitizeHTTPSOptions } from '@platformatic/foundation'
import { ViteCapability } from '@platformatic/vite'
import inject from 'light-my-request'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { satisfies } from 'semver'
import { version } from './schema.js'

export const supportedVersions = {
  nitro: '>=3.0.0-alpha.0 <4.0.0',
  nitropack: '^2.10.0'
}

const viteConfigFiles = [
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
  'vite.config.ts',
  'vite.config.mts',
  'vite.config.cts'
]

const productionEnvironmentKeys = [
  'HOST',
  'NITRO_HOST',
  'PORT',
  'NITRO_PORT',
  'NITRO_SHUTDOWN_DISABLED',
  'NITRO_SHUTDOWN_NO_FORCE_EXIT',
  'NITRO_SSL_CERT',
  'NITRO_SSL_KEY'
]

export async function resolveNitroPackage (root) {
  let names = ['nitro', 'nitropack']

  try {
    const applicationPackageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf-8'))
    const declared = names.filter(name => hasDependency(applicationPackageJson, name))

    if (declared.length > 0) {
      names = declared
    }
  } catch {
    // Package resolution below provides the useful error when package.json is absent or invalid.
  }

  for (const name of names) {
    let packageJsonPath

    try {
      packageJsonPath = resolvePackageViaCJS(root, `${name}/package.json`)
    } catch {
      continue
    }

    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))
    return { name, root: dirname(packageJsonPath), packageJson }
  }

  throw new Error('Cannot find the "nitro" or "nitropack" package. Please add it to the application dependencies.')
}

export function hasViteConfigFile (root, config) {
  const configFile = config?.vite?.configFile

  if (configFile === false) {
    return false
  }

  if (typeof configFile === 'string') {
    return existsSync(resolve(root, configFile))
  }

  return viteConfigFiles.some(file => existsSync(resolve(root, file)))
}

export class NitroCapability extends BaseCapability {
  #nitro
  #basePath
  #server
  #dispatcher

  constructor (root, config, context) {
    super('nitro', version, root, config, context)
    this.exitOnUnhandledErrors = false
    this.subprocessTerminationSignal = 'SIGKILL'
  }

  async init () {
    await super.init()

    if (this.serverConfig?.http2) {
      throw new Error(
        'Nitro does not support server.http2. Remove it from the application or runtime server configuration.'
      )
    }

    if (!this.isProduction) {
      this.#nitro = await resolveNitroPackage(this.root)
      const range = supportedVersions[this.#nitro.name]

      if (!satisfies(this.#nitro.packageJson.version, range, { includePrerelease: true })) {
        throw new errors.UnsupportedVersion(this.#nitro.name, this.#nitro.packageJson.version, range)
      }
    }

    this.#basePath = this.config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(this.config.application.basePath))
      : undefined
    this.registerGlobals({ basePath: this.#basePath })
  }

  async start ({ listen }) {
    /* c8 ignore next 3 */
    if (this.url) {
      return this.url
    }

    await super._start({ listen })

    const command = this.config.application.commands[this.isProduction ? 'production' : 'development']
    if (command) {
      if (!this.isProduction) {
        return this.#runWithBasePathEnvironment(() => this.startWithCommand(command))
      }

      return this.startWithCommand(command)
    }

    if (this.isProduction) {
      await this.#startProduction()
    } else {
      await this.#startDevelopment()
    }

    await this._collectMetrics()
    return this.url
  }

  async stop () {
    await super.stop()

    if (this.childManager) {
      return this.stopCommand()
    }

    if (this.#server?.listening) {
      return this._closeServer(this.#server)
    }
  }

  setClosing () {
    super.setClosing()

    if (this.runtimeConfig?.gracefulShutdown?.closeConnections !== false) {
      this.#server?.closeHttp2Sessions?.()
    }
  }

  async build () {
    if (!this.#nitro) {
      await this.init()
    }

    const config = this.config
    const command = config.application.commands.build ?? [
      process.execPath,
      resolve(this.#nitro.root, 'dist/cli/index.mjs'),
      'build'
    ]

    return this.#runWithBasePathEnvironment(() => this.buildWithCommand(command, this.#basePath))
  }

  async inject (injectParams, onInject) {
    if (!this.isProduction || !this.#dispatcher) {
      return injectViaRequest(this.url, injectParams, onInject)
    }

    const res = await inject(this.#dispatcher, injectParams, onInject)

    if (onInject) {
      return
    }

    const { statusCode, headers, body, payload, rawPayload } = res
    return { statusCode, headers, body, payload, rawPayload }
  }

  getMeta () {
    const hasBasePath = this.basePath || this.#basePath

    return {
      gateway: {
        tcp: typeof this.url !== 'undefined',
        url: this.url,
        prefix: this.basePath ?? this.#basePath,
        wantsAbsoluteUrls: !!hasBasePath,
        needsRootTrailingSlash: false
      }
    }
  }

  /* c8 ignore next 5 */
  async getWatchConfig () {
    return {
      enabled: false
    }
  }

  async #startDevelopment () {
    let { hostname, port, https } = this.serverConfig ?? {}
    hostname ||= '127.0.0.1'
    port ||= 0
    const command = [
      process.execPath,
      resolve(this.#nitro.root, 'dist/cli/index.mjs'),
      'dev',
      '--port',
      port.toString(),
      '--host',
      hostname
    ]

    if (https && this.#nitro.name === 'nitro') {
      throw new Error(
        'HTTPS is not supported by the Nitro 3 CLI in development mode. Use Nitro as a Vite plugin or a custom development command.'
      )
    }

    if (https && this.#nitro.name === 'nitropack') {
      command.push('--https')

      for (const property of ['key', 'cert']) {
        const value = https[property]
        if (
          value !== undefined &&
          (typeof value !== 'object' || Array.isArray(value) || typeof value.path !== 'string')
        ) {
          throw new Error(
            `Nitropack development HTTPS requires server.https.${property} to use a single { path } value; inline strings and arrays are not supported.`
          )
        }
      }

      if (https.key) {
        command.push('--https.key', resolve(this.root, https.key.path))
      }
      if (https.cert) {
        command.push('--https.cert', resolve(this.root, https.cert.path))
      }
    }

    await this.#runWithBasePathEnvironment(() => this.startWithCommand(command))

    if (https && this.#nitro.name === 'nitropack') {
      this.url = this.url.replace(/^http:/, 'https:')
    }

    return this.url
  }

  async #startProduction () {
    const outputDirectory = resolve(
      this.root,
      this.config.nitro?.outputDirectory ?? this.config.application.outputDirectory ?? '.output'
    )
    const entrypoint = this.config.nitro?.entrypoint ?? 'server/index.mjs'
    this.verifyOutputDirectory(outputDirectory)

    const entrypointPath = resolve(outputDirectory, entrypoint)
    if (!existsSync(entrypointPath)) {
      throw new Error(
        `Cannot access Nitro entrypoint '${entrypointPath}'. Please run the 'build' command before running in production mode.`
      )
    }

    const serverConfig = this.serverConfig
    const host = serverConfig?.hostname ?? '127.0.0.1'
    const port = serverConfig?.port ?? 0
    const originalEnvironment = Object.fromEntries(productionEnvironmentKeys.map(key => [key, process.env[key]]))
    const httpsOptions = await sanitizeHTTPSOptions(serverConfig?.https)

    process.env.HOST = host
    process.env.NITRO_HOST = host
    process.env.PORT = port.toString()
    process.env.NITRO_PORT = port.toString()
    process.env.NITRO_SHUTDOWN_DISABLED = 'true'
    process.env.NITRO_SHUTDOWN_NO_FORCE_EXIT = 'true'
    delete process.env.NITRO_SSL_CERT
    delete process.env.NITRO_SSL_KEY

    if (httpsOptions?.cert) {
      process.env.NITRO_SSL_CERT = this.#serializeCertificate(httpsOptions.cert)
    }
    if (httpsOptions?.key) {
      process.env.NITRO_SSL_KEY = this.#serializeCertificate(httpsOptions.key)
    }

    let serverPromise

    try {
      serverPromise = createServerListener(
        serverConfig?.port ?? true,
        serverConfig?.hostname ?? true,
        await buildAdditionalServerOptions(serverConfig)
      )
      await importFile(entrypointPath)
      this.#server = await serverPromise
      this.#dispatcher = this.#server.listeners('request')[0]
      this.url = getServerUrl(this.#server)
      return this.url
    } catch (error) {
      serverPromise?.cancel()
      throw error
    } finally {
      this.#restoreEnvironment(originalEnvironment)
    }
  }

  #serializeCertificate (value) {
    if (Array.isArray(value)) {
      return value.map(item => item.toString()).join('\n')
    }

    return value.toString()
  }

  #restoreEnvironment (originalEnvironment) {
    for (const key of productionEnvironmentKeys) {
      if (typeof originalEnvironment[key] === 'undefined') {
        delete process.env[key]
      } else {
        process.env[key] = originalEnvironment[key]
      }
    }
  }

  async #runWithBasePathEnvironment (fn) {
    const originalValue = process.env.NITRO_APP_BASE_URL
    process.env.NITRO_APP_BASE_URL = this.config.application?.basePath ?? '/'

    try {
      return await fn()
    } finally {
      if (originalValue === undefined) {
        delete process.env.NITRO_APP_BASE_URL
      } else {
        process.env.NITRO_APP_BASE_URL = originalValue
      }
    }
  }
}

export class NitroViteCapability extends ViteCapability {
  #basePath
  #server
  #dispatcher

  constructor (root, config, context) {
    super(root, config, context)
    this.type = 'nitro'
    this.version = version
    this.exitOnUnhandledErrors = false
    this.subprocessTerminationSignal = 'SIGKILL'
  }

  async init () {
    await super.init()

    if (this.serverConfig?.http2) {
      throw new Error(
        'Nitro does not support server.http2. Remove it from the application or runtime server configuration.'
      )
    }

    if (!this.isProduction) {
      const nitro = await resolveNitroPackage(this.root)
      const range = supportedVersions[nitro.name]

      if (!satisfies(nitro.packageJson.version, range, { includePrerelease: true })) {
        throw new errors.UnsupportedVersion(nitro.name, nitro.packageJson.version, range)
      }
    }

    this.#basePath = this.config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(this.config.application.basePath))
      : undefined
    this.registerGlobals({ basePath: this.#basePath })
  }

  async stop () {
    const commandWasRunning = !!this.childManager
    await super.stop()

    if (!commandWasRunning && this.isProduction && this.#server?.listening) {
      return this._closeServer(this.#server)
    }
  }

  setClosing () {
    super.setClosing()

    if (this.isProduction && this.runtimeConfig?.gracefulShutdown?.closeConnections !== false) {
      this.#server?.closeHttp2Sessions?.()
    }
  }

  async build () {
    const command = this.config.application.commands.build
    if (command) {
      return this.buildWithCommand(command)
    }

    const outputDirectory = resolve(
      this.root,
      this.config.nitro?.outputDirectory ?? this.config.application.outputDirectory ?? '.output'
    )
    this.buildInfoPath = resolve(outputDirectory, '.platformatic-build.json')
    return super.build()
  }

  async inject (injectParams, onInject) {
    if (!this.isProduction || !this.#dispatcher) {
      return injectViaRequest(this.url, injectParams, onInject)
    }

    const res = await inject(this.#dispatcher, injectParams, onInject)
    if (onInject) {
      return
    }

    const { statusCode, headers, body, payload, rawPayload } = res
    return { statusCode, headers, body, payload, rawPayload }
  }

  async getChildManagerContext (basePath) {
    const context = await super.getChildManagerContext(basePath)
    context.exitOnUnhandledErrors = false
    return context
  }

  getMeta () {
    if (!this.isProduction) {
      return super.getMeta()
    }

    const hasBasePath = this.basePath || this.#basePath

    return {
      gateway: {
        tcp: typeof this.url !== 'undefined',
        url: this.url,
        prefix: this.basePath ?? this.#basePath,
        wantsAbsoluteUrls: !!hasBasePath,
        needsRootTrailingSlash: false
      }
    }
  }

  async _startProduction () {
    const command = this.config.application.commands.production
    if (command) {
      return this.startWithCommand(command)
    }

    const outputDirectory = resolve(
      this.root,
      this.config.nitro?.outputDirectory ?? this.config.application.outputDirectory ?? '.output'
    )
    const entrypoint = this.config.nitro?.entrypoint ?? 'server/index.mjs'
    this.verifyOutputDirectory(outputDirectory)

    this.buildInfoPath = resolve(outputDirectory, '.platformatic-build.json')
    this.#basePath = await this._getBasePathFromBuildInfo()

    const entrypointPath = resolve(outputDirectory, entrypoint)
    if (!existsSync(entrypointPath)) {
      throw new Error(
        `Cannot access Nitro entrypoint '${entrypointPath}'. Please run the 'build' command before running in production mode.`
      )
    }

    const serverConfig = this.serverConfig
    const host = serverConfig?.hostname ?? '127.0.0.1'
    const port = serverConfig?.port ?? 0
    const originalEnvironment = Object.fromEntries(productionEnvironmentKeys.map(key => [key, process.env[key]]))
    const httpsOptions = await sanitizeHTTPSOptions(serverConfig?.https)

    process.env.HOST = host
    process.env.NITRO_HOST = host
    process.env.PORT = port.toString()
    process.env.NITRO_PORT = port.toString()
    process.env.NITRO_SHUTDOWN_DISABLED = 'true'
    process.env.NITRO_SHUTDOWN_NO_FORCE_EXIT = 'true'
    delete process.env.NITRO_SSL_CERT
    delete process.env.NITRO_SSL_KEY

    if (httpsOptions?.cert) {
      process.env.NITRO_SSL_CERT = this.#serializeCertificate(httpsOptions.cert)
    }
    if (httpsOptions?.key) {
      process.env.NITRO_SSL_KEY = this.#serializeCertificate(httpsOptions.key)
    }

    let serverPromise

    try {
      serverPromise = createServerListener(
        serverConfig?.port ?? true,
        serverConfig?.hostname ?? true,
        await buildAdditionalServerOptions(serverConfig)
      )
      await importFile(entrypointPath)
      this.#server = await serverPromise
      this.#dispatcher = this.#server.listeners('request')[0]
      this.url = getServerUrl(this.#server)
      return this.url
    } catch (error) {
      serverPromise?.cancel()
      throw error
    } finally {
      this.#restoreEnvironment(originalEnvironment)
    }
  }

  #serializeCertificate (value) {
    if (Array.isArray(value)) {
      return value.map(item => item.toString()).join('\n')
    }

    return value.toString()
  }

  #restoreEnvironment (originalEnvironment) {
    for (const key of productionEnvironmentKeys) {
      if (typeof originalEnvironment[key] === 'undefined') {
        delete process.env[key]
      } else {
        process.env[key] = originalEnvironment[key]
      }
    }
  }
}

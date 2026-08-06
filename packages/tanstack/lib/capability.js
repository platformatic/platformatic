import {
  cleanBasePath,
  createServerListener,
  ensureTrailingSlash,
  errors,
  getServerUrl,
  importFile,
  resolvePackageViaESM
} from '@platformatic/basic'
import { sanitizeHTTPSOptions } from '@platformatic/foundation'
import { ViteCapability } from '@platformatic/vite'
import inject from 'light-my-request'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { satisfies } from 'semver'
import { packageJson } from './schema.js'

export const supportedVersions = '^1.0.0'

export class TanstackCapability extends ViteCapability {
  #tanstack
  #basePath
  #server
  #dispatcher

  constructor (root, config, context) {
    super(root, config, context)
    this.type = 'tanstack'
    this.version = packageJson.version
    this.exitOnUnhandledErrors = false
  }

  async init () {
    await super.init()

    if (!this.isProduction) {
      this.#tanstack = resolve(dirname(await resolvePackageViaESM(this.root, '@tanstack/react-start')), '../..')
      const tanstackPackage = JSON.parse(await readFile(resolve(this.#tanstack, 'package.json'), 'utf-8'))

      if (!satisfies(tanstackPackage.version, supportedVersions)) {
        throw new errors.UnsupportedVersion('@tanstack/react-start', tanstackPackage.version, supportedVersions)
      }
    }

    const config = this.config
    this.#basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
      : undefined

    this.registerGlobals({ basePath: this.#basePath })

    this.subprocessTerminationSignal = 'SIGKILL'
  }

  async _start () {
    const config = this.config
    const command = config.application.commands[this.isProduction ? 'production' : 'development']

    if (command) {
      return this.startWithCommand(command)
    }

    if (typeof this.serverConfig?.port === 'undefined') {
      return
    }

    if (!this.isProduction) {
      return super._start()
    }

    await this.#startProduction()
  }

  async #startProduction () {
    const config = this.config
    const outputDirectory = resolve(this.root, config.application.outputDirectory)
    this.verifyOutputDirectory(outputDirectory)
    this.#basePath = await this._getBasePathFromBuildInfo()

    const serverOptions = this.serverConfig
    const serverPromise = createServerListener()

    const httpsOptions = await sanitizeHTTPSOptions(serverOptions?.https)
    const environment = {
      NITRO_HOST: serverOptions?.hostname ?? '127.0.0.1',
      NITRO_PORT: serverOptions?.port ?? 0,
      NITRO_SSL_CERT: httpsOptions?.cert && this.#serializeCertificateValue(httpsOptions.cert),
      NITRO_SSL_KEY: httpsOptions?.key && this.#serializeCertificateValue(httpsOptions.key)
    }
    const originalEnvironment = new Map()

    for (const [key, value] of Object.entries(environment)) {
      if (typeof value === 'undefined') {
        continue
      }

      originalEnvironment.set(key, process.env[key])
      process.env[key] = value.toString()
    }

    try {
      await this.#importProductionNitro(outputDirectory)
    } finally {
      for (const [key, value] of originalEnvironment) {
        this.#restoreEnvironmentVariables(key, value)
      }
    }

    this.#server = await serverPromise
    this.#dispatcher = this.#server.listeners('request')[0]
    this.url = getServerUrl(this.#server)
    await this._collectMetrics()

    return this.url
  }

  async _stop () {
    const hasChildrenManager = !!this.childManager
    await super._stop()

    // ViteCapability.stop already stops child processs
    if (hasChildrenManager || !this.isProduction) {
      return
    }

    /* c8 ignore next 3 */
    if (!this.#server?.listening) {
      return
    }

    return this._closeServer(this.#server)
  }

  async inject (injectParams, onInject) {
    if (!this.isProduction) {
      return super.inject(injectParams, onInject)
    }

    const res = await inject(this.#dispatcher, injectParams, onInject)

    /* c8 ignore next 3 */
    if (onInject) {
      return
    }

    // Since inject might be called from the main thread directly via ITC, let's clean it up
    const { statusCode, headers, body, payload, rawPayload } = res
    return { statusCode, headers, body, payload, rawPayload }
  }

  #importProductionNitro (outputDirectory) {
    return importFile(resolve(outputDirectory, 'server/index.mjs'))
  }

  #serializeCertificateValue (value) {
    if (Array.isArray(value)) {
      return value.map(item => item.toString()).join('\n')
    }

    return value.toString()
  }

  #restoreEnvironmentVariables (key, originalValue) {
    if (typeof originalValue === 'undefined') {
      delete process.env[key]
    } else {
      process.env[key] = originalValue
    }
  }
}

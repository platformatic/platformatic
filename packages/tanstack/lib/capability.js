import {
  buildAdditionalServerOptions,
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

  async start ({ listen }) {
    // Make this idempotent
    /* c8 ignore next 3 */
    if (this.url) {
      return this.url
    }

    await super._start({ listen })

    const config = this.config
    const command = config.application.commands[this.isProduction ? 'production' : 'development']

    if (command) {
      return this.startWithCommand(command)
    } else if (!this.isProduction) {
      return super.start({ listen })
    }

    await this.#startProduction({ listen })
  }

  async #startProduction () {
    const config = this.config
    const outputDirectory = resolve(this.root, config.application.outputDirectory)
    this.verifyOutputDirectory(outputDirectory)
    this.#basePath = await this._getBasePathFromBuildInfo()

    const serverOptions = this.serverConfig
    const serverPromise = createServerListener(
      serverOptions?.port ?? true,
      serverOptions?.hostname ?? true,
      await buildAdditionalServerOptions(serverOptions)
    )

    const httpsOptions = await sanitizeHTTPSOptions(serverOptions?.https)

    if (!httpsOptions?.cert && !httpsOptions?.key) {
      await this.#importProductionNitro(outputDirectory)
    } else {
      const originalCert = process.env.NITRO_SSL_CERT
      const originalKey = process.env.NITRO_SSL_KEY

      process.env.NITRO_SSL_CERT = this.#serializeCertificateValue(httpsOptions.cert)
      process.env.NITRO_SSL_KEY = this.#serializeCertificateValue(httpsOptions.key)

      try {
        await this.#importProductionNitro(outputDirectory)
      } finally {
        this.#restoreEnvironmentVariables('NITRO_SSL_CERT', originalCert)
        this.#restoreEnvironmentVariables('NITRO_SSL_KEY', originalKey)
      }
    }

    this.#server = await serverPromise
    this.#dispatcher = this.#server.listeners('request')[0]
    this.url = getServerUrl(this.#server)
    await this._collectMetrics()

    return this.url
  }

  async stop () {
    const hasChildrenManager = !!this.childManager
    await super.stop()

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

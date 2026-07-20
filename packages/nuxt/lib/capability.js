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
  resolvePackageViaESM,
} from '@platformatic/basic'
import {
  sanitizeHTTPSArgument,
  sanitizeHTTPSOptions,
} from '@platformatic/foundation'
import inject from 'light-my-request'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { satisfies } from 'semver'
import { readSchedulerManifest } from './scheduled-tasks.js'
import { version } from './schema.js'

export const supportedVersions = '^4.0.0'

export class NuxtCapability extends BaseCapability {
  #nuxt
  #basePath
  #server
  #dispatcher
  #scheduledTasks
  #schedulerManifest
  #scheduledTasksRunner

  constructor (root, config, context) {
    super('nuxt', version, root, config, context)
    this.exitOnUnhandledErrors = false
    this.subprocessTerminationSignal = 'SIGKILL'
  }

  async init () {
    await super.init()

    if (!this.isProduction) {
      this.#nuxt = resolve(
        dirname(await resolvePackageViaESM(this.root, 'nuxt')),
        '..'
      )
      const nuxtPackage = JSON.parse(
        await readFile(resolve(this.#nuxt, 'package.json'), 'utf-8')
      )

      if (!satisfies(nuxtPackage.version, supportedVersions)) {
        throw new errors.UnsupportedVersion(
          'nuxt',
          nuxtPackage.version,
          supportedVersions
        )
      }
    }

    this.#basePath = this.config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(this.config.application.basePath))
      : undefined

    this.registerGlobals({ basePath: this.#basePath })
  }

  async start ({ listen }) {
    // Make this idempotent
    /* c8 ignore next 3 */
    if (this.url) {
      return this.url
    }

    await super._start({ listen })

    const command =
      this.config.application.commands[
        this.isProduction ? 'production' : 'development'
      ]

    if (command) {
      return this.startWithCommand(command)
    }

    // In development mode we use Nuxt CLI
    if (!this.isProduction) {
      await this.#startDevelopment()
    } else {
      await this.#startProduction()
    }

    await this._collectMetrics()
  }

  async stop () {
    await super.stop()

    if (this.childManager) {
      return this.stopCommand()
    }

    /* c8 ignore next 3 */
    if (!this.#server?.listening) {
      return
    }

    return this._closeServer(this.#server)
  }

  async build () {
    if (!this.#nuxt) {
      await this.init()
    }

    const config = this.config
    return this.buildWithCommand(
      config.application.commands.build ??
        `node ${resolve(this.#nuxt)}/bin/nuxt.mjs build`,
      this.#basePath
    )
  }

  async inject (injectParams, onInject) {
    if (!this.isProduction) {
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
        needsRootTrailingSlash: false,
      },
    }
  }

  async getScheduledTasks () {
    if (!this.isProduction) {
      return this.#scheduledTasks ?? []
    }

    this.#schedulerManifest ??= readSchedulerManifest(
      resolve(this.root, this.config.nuxt?.outputDirectory ?? '.output')
    )
    this.#scheduledTasks ??= await this.#schedulerManifest
    return this.#scheduledTasks
  }

  async runScheduledTasks (scheduleId, scheduledTime) {
    if (this.childManager) {
      if (!this.clientWs) {
        throw new Error('The application has not started yet')
      }

      return this.childManager.send(this.clientWs, 'platformatic:nuxt:run-scheduled-tasks', {
        scheduleId,
        scheduledTime,
      })
    }

    if (!this.#scheduledTasksRunner) {
      throw new Error('The application does not use the @platformatic/nuxt/scheduler module')
    }

    return this.#scheduledTasksRunner({ scheduleId, scheduledTime })
  }

  setScheduledTasksRunner (runner) {
    this.#scheduledTasksRunner = runner
  }

  setupChildManagerEventsForwarding (childManager) {
    super.setupChildManagerEventsForwarding(childManager)
    childManager.on('platformatic:nuxt:scheduled-tasks', scheduledTasks => {
      this.#scheduledTasks = scheduledTasks
    })
  }

  /* c8 ignore next 5 */
  async getWatchConfig () {
    return {
      enabled: false,
    }
  }

  async #startDevelopment () {
    let { hostname, port, https } = this.serverConfig ?? {}
    hostname ||= '127.0.0.1'
    port ||= 0
    let httpsArgs = ''

    if (https) {
      httpsArgs = ' --https'

      const key = await sanitizeHTTPSArgument(https.key, true)
      const cert = await sanitizeHTTPSArgument(https.cert, true)

      if (https.key) {
        httpsArgs += ` --https.key ${resolve(this.root, key)}`
      }

      if (https.cert) {
        httpsArgs += ` --https.cert ${resolve(this.root, cert)}`
      }
    }

    await this.startWithCommand(
      `node ${resolve(this.#nuxt)}/bin/nuxt.mjs dev --host ${hostname} --port ${port} --no-open${httpsArgs}`
    )

    if (https) {
      this.url = this.url.replace(/^http:/, 'https:')
    }

    return this.url
  }

  async #startProduction () {
    const config = this.config
    const outputDirectory = resolve(
      this.root,
      config.nuxt?.outputDirectory ?? '.output'
    )
    this.verifyOutputDirectory(outputDirectory)
    // this.#basePath = await this._getBasePathFromBuildInfo()

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

      process.env.NITRO_SSL_CERT = this.#serializeCertificateValue(
        httpsOptions.cert
      )
      process.env.NITRO_SSL_KEY = this.#serializeCertificateValue(
        httpsOptions.key
      )

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

  #importProductionNitro (outputDirectory) {
    return importFile(resolve(outputDirectory, 'server/index.mjs'))
  }

  #serializeCertificateValue (value) {
    if (Array.isArray(value)) {
      return value.map((item) => item.toString()).join('\n')
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

import { cleanBasePath, createServerListener, ensureTrailingSlash, errors, getServerUrl } from '@platformatic/basic'
import { importFile, resolvePackageViaESM } from '@platformatic/basic/lib/utils.js'
import { ensureLoggableError } from '@platformatic/foundation'
import { ViteCapability } from '@platformatic/vite'
import inject from 'light-my-request'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { satisfies } from 'semver'
import { packageJson } from './schema.js'

const supportedVersions = '^1.0.0'

export class TanstackCapability extends ViteCapability {
  #tanstack
  #basePath
  #server
  #dispatcher

  constructor (root, config, context) {
    super(root, config, context)
    this.type = 'tanstack'
    this.version = packageJson.version
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

    const buildInfoPath = resolve(outputDirectory, '.platformatic-build.json')

    if (!this.#basePath && existsSync(buildInfoPath)) {
      try {
        const buildInfo = JSON.parse(await readFile(buildInfoPath, 'utf-8'))
        this.#basePath = buildInfo.basePath
      } catch (e) {
        globalThis.platformatic.logger.error({ err: ensureLoggableError(e) }, 'Reading build info failed.')
      }
    }

    const serverOptions = this.serverConfig
    const serverPromise = createServerListener(
      serverOptions?.port ?? true,
      serverOptions?.hostname ?? true,
      typeof serverOptions?.backlog === 'number' ? { backlog: serverOptions.backlog } : {}
    )

    await importFile(resolve(outputDirectory, 'server/index.mjs'))

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

    return new Promise((resolve, reject) => {
      this.#server.close(error => {
        /* c8 ignore next 3 */
        if (error) {
          return reject(error)
        }

        resolve()
      })
    })
  }

  getMeta () {
    if (!this.isProduction) {
      return super.getMeta()
    }

    return {
      gateway: {
        tcp: typeof this.url !== 'undefined',
        url: this.url,
        prefix: this.basePath ?? this.#basePath,
        wantsAbsoluteUrls: true,
        needsRootTrailingSlash: true
      }
    }
  }

  async inject (injectParams, onInject) {
    if (!this.isProduction) {
      return super.inject(injectParams, onInject)
    }

    const res = await inject(this.#dispatcher, injectParams, onInject)

    /* c8 ignore next 3 */
    if (onInject) {
      return
    } // Since inject might be called from the main thread directly via ITC, let's clean it up

    const { statusCode, headers, body, payload, rawPayload } = res
    return { statusCode, headers, body, payload, rawPayload }
  }
}

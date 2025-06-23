import {
  cleanBasePath,
  ensureTrailingSlash,
  errors,
  getServerUrl,
  importFile,
  resolvePackage,
  schemaOptions,
  transformConfig
} from '@platformatic/basic'
import { ConfigManager } from '@platformatic/config'
import { features } from '@platformatic/utils'
import { ViteStackable } from '@platformatic/vite'
import { createRequestHandler } from '@remix-run/express'
import express from 'express'
import inject from 'light-my-request'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pinoHttp } from 'pino-http'
import { satisfies } from 'semver'
import { packageJson, schema } from './lib/schema.js'

const supportedVersions = '^2.0.0'

export class RemixStackable extends ViteStackable {
  #app
  #server
  #dispatcher
  #remix
  #basePath

  constructor (options, root, configManager) {
    super(options, root, configManager)

    this.type = 'remix'
    this.version = packageJson.version
  }

  async init () {
    await super.init()

    if (!this.isProduction) {
      this.#remix = resolve(dirname(resolvePackage(this.root, '@remix-run/dev')), '..')
      const remixPackage = JSON.parse(await readFile(resolve(this.#remix, 'package.json'), 'utf-8'))

      if (!satisfies(remixPackage.version, supportedVersions)) {
        throw new errors.UnsupportedVersion('@remix-run/dev', remixPackage.version, supportedVersions)
      }
    }

    const config = this.configManager.current
    this.#basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
      : undefined

    this.registerGlobals({ basePath: this.#basePath })

    this.subprocessTerminationSignal = 'SIGKILL'
  }

  async start ({ listen }) {
    // Make this idempotent
    if (this.url) {
      return this.url
    }

    const config = this.configManager.current
    const command = config.application.commands[this.isProduction ? 'production' : 'development']

    if (command) {
      return this.startWithCommand(command)
    }

    return this.isProduction ? this.#startProduction(listen) : this.#startDevelopment(listen)
  }

  async stop () {
    if (this.childManager) {
      return this.stopCommand()
    }

    if (this.isProduction) {
      return this.#stopProduction()
    }

    return super.stop()
  }

  async build () {
    const config = this.configManager.current
    const command = config.application.commands.build
    const basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
      : undefined

    if (command) {
      return this.buildWithCommand(command, basePath)
    }

    await this.init()
    const { viteBuild } = await importFile(resolve(this.#remix, 'dist/cli/commands.js'))

    try {
      globalThis.platformatic.isBuilding = true

      await viteBuild(this.root, {
        emptyOutDir: true,
        logLevel: this.logger.level,
        mode: 'production',
        profile: false
      })
    } finally {
      globalThis.platformatic.isBuilding = false
    }
  }

  async inject (injectParams, onInject) {
    if (!this.isProduction) {
      return super.inject(injectParams, onInject)
    }

    const res = await inject(this.#app, injectParams, onInject)

    /* c8 ignore next 3 */
    if (onInject) {
      return
    }     // Since inject might be called from the main thread directly via ITC, let's clean it up

    const { statusCode, headers, body, payload, rawPayload } = res
    return { statusCode, headers, body, payload, rawPayload }
  }

  getMeta () {
    if (!this.isProduction) {
      return super.getMeta()
    }

    return {
      composer: {
        tcp: typeof this.url !== 'undefined',
        url: this.url,
        prefix: this.basePath ?? this.#basePath,
        wantsAbsoluteUrls: true,
        needsRootTrailingSlash: true
      }
    }
  }

  async #startDevelopment (listen) {
    const preloadViteEsmPath = resolve(this.#remix, './dist/vite/import-vite-esm-sync.js')

    // Older versions
    if (existsSync(preloadViteEsmPath)) {
      const { preloadViteEsm } = await importFile(resolve(this.#remix, './dist/vite/import-vite-esm-sync.js'))
      await preloadViteEsm()
    } else {
      const { preloadVite } = await importFile(resolve(this.#remix, './dist/vite/vite.js'))
      await preloadVite()
    }

    await super.start({ listen })

    /* c8 ignore next 3 */
    if (!this._getVite().config.plugins.some(p => p.name === 'remix')) {
      this.logger.warn('Could not find Remix plugin in your Vite configuration. Continuing as plain Vite application.')
    }

    await this._collectMetrics()
  }

  async #startProduction (listen) {
    // Listen if entrypoint
    if (this.#app && listen) {
      const serverOptions = this.serverConfig
      const listenOptions = { host: serverOptions?.hostname || '127.0.0.1', port: serverOptions?.port || 0 }

      if (this.isProduction && features.node.reusePort) {
        listenOptions.reusePort = true
      }

      this.#server = await new Promise((resolve, reject) => {
        return this.#app
          .listen(listenOptions, function () {
            resolve(this)
          })
          .on('error', reject)
      })

      this.url = getServerUrl(this.#server)

      return this.url
    }

    const outputDirectory = this.configManager.current.remix.outputDirectory
    this.verifyOutputDirectory(resolve(this.root, outputDirectory))

    const build = await importFile(resolve(this.root, `${outputDirectory}/server/index.js`))
    this.#basePath = ensureTrailingSlash(cleanBasePath(build.basename))

    // Setup express app
    this.#app = express()
    this.#app.disable('x-powered-by')
    this.#app.use(pinoHttp({ logger: this.logger }))
    this.#app.use(this.#basePath, express.static(resolve(this.root, `${outputDirectory}/client`)))
    this.#app.all(`${ensureTrailingSlash(cleanBasePath(this.#basePath))}*`, createRequestHandler({ build }))

    await this._collectMetrics()
    return this.url
  }

  async #stopProduction () {
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
}

export async function buildStackable (opts) {
  const root = opts.context.directory

  const configManager = new ConfigManager({
    schema,
    source: opts.config ?? {},
    schemaOptions,
    transformConfig,
    dirname: root,
    context: opts.context
  })
  await configManager.parseAndValidate()

  return new RemixStackable(opts, root, configManager)
}

export { schema, schemaComponents } from './lib/schema.js'

export default {
  configType: 'remix',
  configManagerConfig: {
    schemaOptions,
    transformConfig
  },
  buildStackable,
  schema,
  version: packageJson.version,
  modulesToLoad: []
}

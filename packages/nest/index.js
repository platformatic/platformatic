import {
  BaseStackable,
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
import inject from 'light-my-request'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pinoHttp } from 'pino-http'
import { satisfies } from 'semver'
import { packageJson, schema } from './lib/schema.js'

const supportedVersions = '^11.0.0'

export class NestStackable extends BaseStackable {
  #basePath
  #nestjsCore
  #nestjsCli
  #isFastify
  #app
  #server
  #dispatcher

  constructor (options, root, configManager) {
    super('nest', packageJson.version, options, root, configManager)
  }

  async init () {
    const config = this.configManager.current

    this.#isFastify = config.nest.adapter === 'fastify'
    this.#nestjsCore = resolve(resolvePackage(this.root, '@nestjs/core'))
    // As @nest/cli is not exporting any file, we assume it's in the same folder of @nestjs/core.
    this.#nestjsCli = resolve(this.#nestjsCore, '../../cli/bin/nest.js')

    const nestPackage = JSON.parse(await readFile(resolve(dirname(this.#nestjsCore), 'package.json'), 'utf-8'))

    if (!this.isProduction && !satisfies(nestPackage.version, supportedVersions)) {
      throw new errors.UnsupportedVersion('@nestjs/core', nestPackage.version, supportedVersions)
    }

    this.#basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
      : undefined

    this.registerGlobals({ basePath: this.#basePath })

    this.subprocessForceClose = true
  }

  async start ({ listen }) {
    // Make this idempotent
    if (this.url) {
      return this.url
    }

    const config = this.configManager.current
    const command = config.application.commands[this.isProduction ? 'production' : 'development']

    // In development mode, we use the Nest CLI in a children thread - Using build then start would result in a bad DX
    this.on('config', config => {
      this.#basePath = config.basePath
    })

    if (command || !this.isProduction) {
      await this.startWithCommand(command || `node ${this.#nestjsCli} start --watch --preserveWatchOutput`)
    } else {
      return this.#startProduction(listen)
    }
  }

  async stop () {
    if (this.childManager) {
      return this.stopCommand()
    }

    if (this.#isFastify) {
      return this.#server.close()
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

  async build () {
    if (!this.#nestjsCore) {
      await this.init()
    }

    const config = this.configManager.current
    this.#basePath = config.application?.basePath ? cleanBasePath(config.application?.basePath) : ''

    return this.buildWithCommand(config.application.commands.build ?? `node ${this.#nestjsCli} build`, this.#basePath)
  }

  async inject (injectParams, onInject) {
    let res

    if (this.startHttpTimer && this.endHttpTimer) {
      this.startHttpTimer({ request: injectParams })
      if (onInject) {
        const originalOnInject = onInject
        onInject = (err, response) => {
          this.endHttpTimer({ request: injectParams, response })
          originalOnInject(err, response)
        }
      }
    }

    if (this.#isFastify) {
      res = await this.#server.inject(injectParams, onInject)
    } else {
      res = await inject(this.#dispatcher, injectParams, onInject)
    }

    /* c8 ignore next 3 */
    if (onInject) {
      return
    } else if (this.endHttpTimer) {
      this.endHttpTimer({ request: injectParams, response: res })
    }

    // Since inject might be called from the main thread directly via ITC, let's clean it up
    const { statusCode, headers, body, payload, rawPayload } = res
    return { statusCode, headers, body, payload, rawPayload }
  }

  getMeta () {
    const hasBasePath = this.basePath || this.#basePath

    return {
      composer: {
        tcp: typeof this.url !== 'undefined',
        url: this.url,
        prefix: this.basePath ?? this.#basePath,
        wantsAbsoluteUrls: !!hasBasePath,
        needsRootRedirect: false
      }
    }
  }

  /* c8 ignore next 5 */
  async getWatchConfig () {
    return {
      enabled: false
    }
  }

  async #startProduction (listen) {
    // Listen if entrypoint
    if (this.#app && listen) {
      await this.#listen()
      return this.url
    }

    const outputDirectory = this.configManager.current.application.outputDirectory
    const { path, name } = this.configManager.current.nest.appModule
    this.verifyOutputDirectory(resolve(this.root, outputDirectory))

    // Import all the necessary modules
    const { NestFactory } = await importFile(this.#nestjsCore)
    const Adapter = await this.#importAdapter()
    const appModuleExport = await importFile(resolve(this.root, `${outputDirectory}/${path}.js`))
    const appModule = appModuleExport[name]
    const setup = await this.#importSetup()

    // Create the server
    if (this.#isFastify) {
      this.#app = await NestFactory.create(appModule, new Adapter({ loggerInstance: this.logger }))

      setup?.(this.#app)
      await this.#app.init()

      this.#server = this.#app.getInstance()
    } else {
      this.#app = await NestFactory.create(appModule, new Adapter())

      const instance = this.#app.getInstance()
      instance.disable('x-powered-by')
      instance.use(pinoHttp({ logger: this.logger }))

      setup?.(this.#app)
      await this.#app.init()

      this.#server = this.#app.getHttpServer()
      this.#dispatcher = this.#server.listeners('request')[0]
    }

    if (listen) {
      await this.#listen()
    }

    this._collectMetrics()
    return this.url
  }

  async #listen () {
    const serverOptions = this.serverConfig
    const listenOptions = { host: serverOptions?.hostname || '127.0.0.1', port: serverOptions?.port || 0 }

    if (this.isProduction && features.node.reusePort) {
      listenOptions.reusePort = true
    }

    await this.#app.listen(listenOptions)
    this.url = getServerUrl(this.#isFastify ? this.#server.server : this.#server)

    return this.url
  }

  async #importAdapter () {
    let adapter
    const toImport = `@nestjs/platform-${this.configManager.current.nest.adapter}`

    this.logger.debug(`Using NestJS adapter ${toImport}.`)

    try {
      adapter = await importFile(resolvePackage(this.root, toImport))
      return adapter[this.#isFastify ? 'FastifyAdapter' : 'ExpressAdapter']
    } catch (e) {
      throw new Error(`Cannot import the NestJS adapter. Please add ${toImport} to the dependencies and try again.`)
    }
  }

  async #importSetup () {
    const config = this.configManager.current

    if (!config.nest.setup.path) {
      return undefined
    }

    let setupModule
    let setup

    try {
      setupModule = await importFile(
        resolve(this.root, `${config.application.outputDirectory}/${config.nest.setup.path}.js`)
      )
    } catch (e) {
      throw new Error(`Cannot import the NestJS setup file: ${e.message}.`)
    }

    // This is for improved compatibility
    if (config.nest.setup.name) {
      setup = setupModule[config.setup.name]
    } else {
      setup = setupModule.default

      if (setup && typeof setup !== 'function' && typeof setup.default === 'function') {
        setup = setup.default
      }
    }

    if (typeof setup !== 'function') {
      const name = config.setup.name ? ` named ${config.setup.name}` : ''
      throw new Error(`The NestJS setup file must export a function named ${name}, but got ${typeof setup}.`)
    }

    return setup
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

  return new NestStackable(opts, root, configManager)
}

export { schema, schemaComponents } from './lib/schema.js'

export default {
  configType: 'nest',
  configManagerConfig: {
    schemaOptions,
    transformConfig
  },
  buildStackable,
  schema,
  version: packageJson.version,
  modulesToLoad: []
}

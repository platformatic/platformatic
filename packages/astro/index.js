import middie from '@fastify/middie'
import fastifyStatic from '@fastify/static'
import {
  BaseStackable,
  transformConfig as basicTransformConfig,
  cleanBasePath,
  createServerListener,
  ensureTrailingSlash,
  errors,
  getServerUrl,
  importFile,
  resolvePackage,
  schemaOptions
} from '@platformatic/basic'
import { ConfigManager } from '@platformatic/config'
import { features } from '@platformatic/utils'
import fastify from 'fastify'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { satisfies } from 'semver'
import { packageJson, schema } from './lib/schema.js'

const supportedVersions = '^4.0.0 || ^5.0.0'

export class AstroStackable extends BaseStackable {
  #astro
  #app
  #server
  #basePath

  constructor (options, root, configManager) {
    super('astro', packageJson.version, options, root, configManager)
  }

  async init () {
    if (this.isProduction) {
      return
    }

    this.#astro = resolve(dirname(resolvePackage(this.root, 'astro')), '../..')
    const astroPackage = JSON.parse(await readFile(resolve(this.#astro, 'package.json'), 'utf-8'))

    if (!satisfies(astroPackage.version, supportedVersions)) {
      throw new errors.UnsupportedVersion('astro', astroPackage.version, supportedVersions)
    }
  }

  async start ({ listen }) {
    // Make this idempotent
    if (this.url) {
      return this.url
    }

    if (this.isProduction) {
      await this.#startProduction(listen)
    } else {
      await this.#startDevelopment(listen)
    }

    await this._collectMetrics()
  }

  async stop () {
    if (this.childManager) {
      return this.stopCommand()
    }

    return this.isProduction ? this.#app.close() : this.#app.stop()
  }

  async build () {
    const config = this.configManager.current
    const command = config.application.commands.build
    const configFile = config.astro.configFile // Note: Astro expect this to be a relative path to the root
    let basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
      : undefined

    if (command) {
      return this.buildWithCommand(command, basePath)
    }

    await this.init()
    const { build } = await importFile(resolve(this.#astro, 'dist/core/index.js'))

    try {
      globalThis.platformatic.isBuilding = true

      await build({
        root: this.root,
        base: basePath,
        outDir: config.application.outputDirectory,
        mode: 'production',
        configFile,
        logLevel: this.logger.level,
        integrations: [
          {
            name: 'platformatic',
            hooks: {
              'astro:config:done': ({ config }) => {
                basePath = ensureTrailingSlash(cleanBasePath(config.base))
              }
            }
          }
        ]
      })
    } finally {
      globalThis.platformatic.isBuilding = false
    }

    await writeFile(
      resolve(this.root, config.application.outputDirectory, '.platformatic-build.json'),
      JSON.stringify({ basePath }),
      'utf-8'
    )
  }

  /* c8 ignore next 5 */
  async getWatchConfig () {
    return {
      enabled: false
    }
  }

  getMeta () {
    const config = this.subprocessConfig ?? this.#app?.config

    const composer = {
      tcp: typeof this.url !== 'undefined',
      url: this.url,
      prefix: this.basePath ?? config?.base ?? this.#basePath,
      wantsAbsoluteUrls: true,
      needsRootRedirect: true,
      needsRefererBasedRedirect: !this.isProduction
    }

    return { composer }
  }

  // This is only used in non SSR production mode as in other modes a TCP server is started
  async inject (injectParams, onInject) {
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

    const res = await this.#app.inject(injectParams, onInject)

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

  async #startDevelopment () {
    // Make this idempotent
    if (this.url) {
      return this.url
    }

    const config = this.configManager.current
    const command = this.configManager.current.application.commands.development

    this.#basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
      : undefined

    this.registerGlobals({ basePath: this.#basePath })

    if (command) {
      return this.startWithCommand(command)
    }

    // Prepare options
    const { hostname, port } = this.serverConfig ?? {}
    const configFile = config.astro.configFile // Note: Astro expect this to be a relative path to the root

    const serverOptions = {
      host: hostname || '127.0.0.1',
      port: port || 0
    }

    // Require Astro
    const serverPromise = createServerListener(
      (this.isEntrypoint ? serverOptions?.port : undefined) ?? true,
      (this.isEntrypoint ? serverOptions?.hostname : undefined) ?? true
    )
    const { dev } = await importFile(resolve(this.#astro, 'dist/core/index.js'))

    // Create the server and listen
    this.#app = await dev({
      root: this.root,
      base: this.#basePath,
      mode: 'development',
      configFile,
      logLevel: this.logger.level,
      server: serverOptions,
      vite: {
        server: {
          allowedHosts: ['.plt.local']
        }
      },
      integrations: [
        {
          name: 'platformatic',
          hooks: {
            'astro:config:setup': ({ config }) => {
              this.#basePath = ensureTrailingSlash(cleanBasePath(config.base))

              /*
                As Astro generates invalid paths in development mode which ignore the basePath
                (see https://github.com/withastro/astro/issues/11445), make sure we provide
                the prefix in HMR path.
              */
              config.vite.server ??= {}
              config.vite.server.hmr ??= {}
              config.vite.server.hmr.path = `/${this.#basePath}/`.replaceAll(/\/+/g, '/')
              config.vite.server.fs ??= {}
              config.vite.server.fs.strict = false
            }
          }
        }
      ]
    })

    this.#server = await serverPromise
    this.url = getServerUrl(this.#server)
  }

  async #startProduction (listen) {
    const config = this.configManager.current
    const command = this.configManager.current.application.commands.production
    const outputDirectory = config.application.outputDirectory

    this.#basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
      : undefined

    this.registerGlobals({ basePath: this.#basePath })

    if (command) {
      return this.startWithCommand(command)
    }

    if (this.#app && listen) {
      const serverOptions = this.serverConfig
      const listenOptions = { host: serverOptions?.hostname || '127.0.0.1', port: serverOptions?.port || 0 }

      if (this.isProduction && features.node.reusePort) {
        listenOptions.reusePort = true
      }

      await this.#app.listen(listenOptions)
      this.url = getServerUrl(this.#app.server)
      return this.url
    }

    this.#app = fastify({ loggerInstance: this.logger })

    const root = resolve(this.root, outputDirectory)
    this.verifyOutputDirectory(root)

    const buildInfoPath = resolve(root, '.platformatic-build.json')

    if (!this.#basePath && existsSync(buildInfoPath)) {
      try {
        const buildInfo = JSON.parse(await readFile(buildInfoPath, 'utf-8'))
        this.#basePath = buildInfo.basePath
      } catch (e) {
        console.log(e)
      }
    }

    const ssrEntrypoint = resolve(this.root, outputDirectory, 'server/entry.mjs')

    if (existsSync(ssrEntrypoint)) {
      const { handler } = await importFile(ssrEntrypoint)

      await this.#app.register(fastifyStatic, {
        root: resolve(this.root, outputDirectory, 'client'),
        prefix: this.#basePath,
        prefixAvoidTrailingSlash: true,
        schemaHide: true
      })

      await this.#app.register(middie)
      await this.#app.use(this.#basePath, handler)
    } else {
      await this.#app.register(fastifyStatic, {
        root,
        prefix: this.#basePath,
        prefixAvoidTrailingSlash: true,
        schemaHide: true
      })
    }

    await this.#app.ready()
  }
}

/* c8 ignore next 9 */
function transformConfig () {
  if (this.current.watch === undefined) {
    this.current.watch = { enabled: false }
  }

  if (typeof this.current.watch !== 'object') {
    this.current.watch = { enabled: this.current.watch || false }
  }

  return basicTransformConfig.call(this)
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

  return new AstroStackable(opts, root, configManager)
}

export { schema, schemaComponents } from './lib/schema.js'

export default {
  configType: 'astro',
  configManagerConfig: {
    schemaOptions,
    transformConfig
  },
  buildStackable,
  schema,
  version: packageJson.version,
  modulesToLoad: []
}

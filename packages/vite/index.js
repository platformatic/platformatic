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
import { NodeStackable } from '@platformatic/node'
import { features } from '@platformatic/utils'
import fastify from 'fastify'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { satisfies } from 'semver'
import { packageJson, schema } from './lib/schema.js'

const supportedVersions = '^5.0.0'

export class ViteStackable extends BaseStackable {
  #vite
  #app
  #server
  #basePath

  constructor (options, root, configManager) {
    super('vite', packageJson.version, options, root, configManager)
  }

  async init () {
    if (this.isProduction) {
      return
    }

    this.#vite = dirname(resolvePackage(this.root, 'vite'))
    const vitePackage = JSON.parse(await readFile(resolve(this.#vite, 'package.json'), 'utf-8'))

    if (!satisfies(vitePackage.version, supportedVersions)) {
      throw new errors.UnsupportedVersion('vite', vitePackage.version, supportedVersions)
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

    this._collectMetrics()
  }

  async stop () {
    if (this.childManager) {
      return this.stopCommand()
    }

    return this.#app.close()
  }

  async build () {
    const config = this.configManager.current
    const command = config.application.commands.build
    const configFile = config.vite.configFile ? resolve(this.root, config.vite.configFile) : undefined
    let basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
      : undefined
    let outDir

    if (command) {
      return this.buildWithCommand(command, basePath)
    }

    await this.init()
    const { build } = await importFile(resolve(this.#vite, 'dist/node/index.js'))

    try {
      globalThis.platformatic.isBuilding = true

      await build({
        root: this.root,
        base: basePath,
        mode: 'production',
        configFile,
        logLevel: this.logger.level,
        build: {
          outDir: config.application.outputDirectory
        },
        plugins: [
          {
            name: 'platformatic-build',
            configResolved: config => {
              basePath = ensureTrailingSlash(cleanBasePath(config.base))
              outDir = resolve(this.root, config.build.outDir)
            }
          }
        ]
      })
    } finally {
      globalThis.platformatic.isBuilding = false
    }

    await writeFile(resolve(outDir, '.platformatic-build.json'), JSON.stringify({ basePath }), 'utf-8')
  }

  /* c8 ignore next 5 */
  async getWatchConfig () {
    return {
      enabled: false
    }
  }

  // This is only used in production mode
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

  getMeta () {
    const config = this.subprocessConfig ?? this.#app?.config

    const composer = {
      tcp: typeof this.url !== 'undefined',
      url: this.url,
      prefix: this.basePath ?? config?.base ?? this.#basePath,
      wantsAbsoluteUrls: true,
      needsRootRedirect: true
    }

    return { composer }
  }

  _getVite () {
    return this.#app
  }

  async #startDevelopment () {
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
    const { hostname, port, https, cors } = this.serverConfig ?? {}
    const configFile = config.vite.configFile ? resolve(this.root, config.vite.configFile) : undefined

    const serverOptions = {
      host: hostname || '127.0.0.1',
      port: port || 0,
      strictPort: false,
      https,
      cors,
      hmr: true,
      allowedHosts: ['.plt.local'],
      fs: {
        strict: config.vite.devServer.strict
      }
    }

    // Require Vite
    const serverPromise = createServerListener(
      (this.isEntrypoint ? serverOptions?.port : undefined) ?? true,
      (this.isEntrypoint ? serverOptions?.hostname : undefined) ?? true
    )
    const { createServer } = await importFile(resolve(this.#vite, 'dist/node/index.js'))

    // Create the server and listen
    this.#app = await createServer({
      root: this.root,
      base: this.#basePath,
      mode: 'development',
      configFile,
      logLevel: this.logger.level,
      clearScreen: false,
      optimizeDeps: { force: false },
      server: serverOptions
    })

    await this.#app.listen()
    this.#server = await serverPromise
    this.url = getServerUrl(this.#server)
  }

  async #startProduction (listen) {
    const config = this.configManager.current
    const command = this.configManager.current.application.commands.production

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

    const outputDirectory = resolve(this.root, config.application.outputDirectory)
    this.verifyOutputDirectory(outputDirectory)
    const buildInfoPath = resolve(outputDirectory, '.platformatic-build.json')

    if (!this.#basePath && existsSync(buildInfoPath)) {
      try {
        const buildInfo = JSON.parse(await readFile(buildInfoPath, 'utf-8'))
        this.#basePath = buildInfo.basePath
      } catch (e) {
        console.log(e)
      }
    }

    await this.#app.register(fastifyStatic, {
      root: outputDirectory,
      prefix: this.#basePath,
      prefixAvoidTrailingSlash: true,
      schemaHide: true
    })

    await this.#app.ready()
  }
}

export class ViteSSRStackable extends NodeStackable {
  #basePath

  constructor (options, root, configManager) {
    super(options, root, configManager)

    this.type = 'vite'
  }

  _getWantsAbsoluteUrls () {
    return true
  }

  async init () {
    const config = this.configManager.current

    this.#basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
      : undefined

    this.registerGlobals({ basePath: this.#basePath })
  }

  async start ({ listen }) {
    // Make this idempotent
    /* c8 ignore next 3 */
    if (this.url) {
      return this.url
    }

    const config = this.configManager.current
    const command = config.application.commands[this.isProduction ? 'production' : 'development']

    if (command) {
      return this.startWithCommand(command)
    }

    if (this.isProduction) {
      const clientDirectory = config.vite.ssr.clientDirectory
      const clientOutDir = resolve(this.root, clientDirectory, config.application.outputDirectory, clientDirectory)

      this.verifyOutputDirectory(clientOutDir)

      const buildInfoPath = resolve(clientOutDir, '.platformatic-build.json')
      if (!this.#basePath && existsSync(buildInfoPath)) {
        try {
          const buildInfo = JSON.parse(await readFile(buildInfoPath, 'utf-8'))
          this.#basePath = buildInfo.basePath
        } catch (e) {
          console.log(e)
        }
      }
    }

    await super.start({ listen })
    await super._listen()
  }

  async build () {
    const config = this.configManager.current
    const command = config.application.commands.build
    const configFile = config.vite.configFile ? resolve(this.root, config.vite.configFile) : undefined
    let basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
      : undefined

    if (command) {
      return this.buildWithCommand(command, basePath)
    }

    const clientDirectory = config.vite.ssr.clientDirectory
    const serverDirectory = config.vite.ssr.serverDirectory
    let clientOutDir = resolve(this.root, clientDirectory, config.application.outputDirectory, clientDirectory)

    await this.init()
    const vite = dirname(resolvePackage(this.root, 'vite'))
    const { build } = await importFile(resolve(vite, 'dist/node/index.js'))

    // Build the client
    try {
      globalThis.platformatic.isBuilding = true

      await build({
        root: resolve(this.root, clientDirectory),
        base: basePath,
        mode: 'production',
        configFile,
        logLevel: this.logger.level,
        build: {
          outDir: clientOutDir,
          ssrManifest: true
        },
        plugins: [
          {
            name: 'platformatic-build',
            configResolved: config => {
              basePath = ensureTrailingSlash(cleanBasePath(config.base))
              clientOutDir = resolve(this.root, clientDirectory, config.build.outDir)
            }
          }
        ]
      })
    } finally {
      globalThis.platformatic.isBuilding = false
    }

    await writeFile(resolve(clientOutDir, '.platformatic-build.json'), JSON.stringify({ basePath }), 'utf-8')

    // Build the server
    await build({
      root: this.root,
      base: basePath,
      mode: 'production',
      configFile,
      logLevel: this.logger.level,
      build: {
        outDir: resolve(this.root, clientDirectory, config.application.outputDirectory, serverDirectory),
        ssr: resolve(this.root, clientDirectory, 'index.js')
      }
    })
  }

  getMeta () {
    const vite = this._getApplication()?.vite
    const config = vite?.devServer?.config ?? vite?.config.vite
    const applicationBasePath = config?.base

    const composer = {
      tcp: typeof this.url !== 'undefined',
      url: this.url,
      prefix: this.basePath ?? applicationBasePath ?? this.#basePath,
      wantsAbsoluteUrls: true,
      needsRootRedirect: true
    }

    return { composer }
  }

  _findEntrypoint () {
    const config = this.configManager.current.vite ?? {}
    return resolve(this.root, config.ssr.entrypoint)
  }
}

/* c8 ignore next 9 */
export function transformConfig () {
  if (this.current.watch === undefined) {
    this.current.watch = { enabled: false }
  }

  if (typeof this.current.watch !== 'object') {
    this.current.watch = { enabled: this.current.watch || false }
  }

  if (this.current.vite.ssr === true) {
    this.current.vite.ssr = {
      enabled: true,
      entrypoint: 'server.js',
      clientDirectory: 'client',
      serverDirectory: 'server'
    }
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
    dirname: root
  })
  await configManager.parseAndValidate()

  // When in SSR mode, we use ViteSSRStackable, which is a subclass of @platformatic/node
  const viteConfig = configManager.current.vite ?? {}

  if (viteConfig.ssr?.enabled) {
    return new ViteSSRStackable(opts, root, configManager)
  }

  return new ViteStackable(opts, root, configManager)
}

export { schema, schemaComponents } from './lib/schema.js'

export default {
  configType: 'vite',
  configManagerConfig: {
    schemaOptions,
    transformConfig
  },
  buildStackable,
  schema,
  version: packageJson.version,
  modulesToLoad: []
}

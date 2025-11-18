import fastifyStatic from '@fastify/static'
import {
  BaseCapability,
  cleanBasePath,
  createServerListener,
  ensureTrailingSlash,
  errors,
  getServerUrl,
  importFile,
  resolvePackage
} from '@platformatic/basic'
import { ensureLoggableError } from '@platformatic/foundation'
import { NodeCapability } from '@platformatic/node'
import fastify from 'fastify'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parse, satisfies } from 'semver'
import { version } from './schema.js'

const supportedVersions = ['^5.0.0', '^6.0.0', '^7.0.0']

export class ViteCapability extends BaseCapability {
  #vite
  #viteVersion
  #app
  #server
  #basePath

  constructor (root, config, context) {
    super('vite', version, root, config, context)
  }

  async init () {
    await super.init()

    if (this.isProduction) {
      return
    }

    this.#vite = dirname(resolvePackage(this.root, 'vite'))

    // In Vite 6, module resolving changed, adjust it
    if (!existsSync(resolve(this.#vite, 'dist/node/index.js'))) {
      this.#vite = resolve(this.#vite, '../..')
    }

    const vitePackage = JSON.parse(await readFile(resolve(this.#vite, 'package.json'), 'utf-8'))
    this.#viteVersion = parse(vitePackage.version)

    if (!supportedVersions.some(v => satisfies(vitePackage.version, v))) {
      throw new errors.UnsupportedVersion('vite', vitePackage.version, supportedVersions)
    }
  }

  async start ({ listen }) {
    await super._start({ listen })

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
    await super.stop()

    if (this.childManager) {
      return this.stopCommand()
    } else if (this.#app) {
      // This is needed if the capability was subclassed
      return this.#app.close()
    }
  }

  async build () {
    const config = this.config
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
    const res = await this.#app.inject(injectParams, onInject)

    /* c8 ignore next 3 */
    if (onInject) {
      return
    }

    // Since inject might be called from the main thread directly via ITC, let's clean it up
    const { statusCode, headers, body, payload, rawPayload } = res
    return { statusCode, headers, body, payload, rawPayload }
  }

  getMeta () {
    const config = this.subprocessConfig ?? this.#app?.config

    const gateway = {
      tcp: typeof this.url !== 'undefined',
      url: this.url,
      prefix: this.basePath ?? config?.base ?? this.#basePath,
      wantsAbsoluteUrls: true,
      needsRootTrailingSlash: true
    }

    return { gateway }
  }

  _getVite () {
    return this.#app
  }

  async #startDevelopment () {
    const config = this.config
    const command = this.config.application.commands.development

    this.#basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
      : undefined

    this.registerGlobals({ basePath: this.#basePath })

    if (command) {
      return this.startWithCommand(command)
    }

    // Prepare options
    const { hostname, port, https, cors, backlog } = this.serverConfig ?? {}
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

    if (typeof backlog === 'number') {
      serverOptions.backlog = backlog
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
    const config = this.config
    const command = this.config.application.commands.production

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

      if (typeof serverOptions?.backlog === 'number') {
        listenOptions.backlog = serverOptions.backlog
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
        globalThis.platformatic.logger.error({ err: ensureLoggableError(e) }, 'Reading build info failed.')
      }
    }

    await this.#app.register(fastifyStatic, {
      root: outputDirectory,
      prefix: this.#basePath,
      prefixAvoidTrailingSlash: true,
      schemaHide: true
    })

    if (config.vite.notFoundHandler?.enabled) {
      const { statusCode, contentType, path } = config.vite.notFoundHandler

      this.#app.setNotFoundHandler((_, reply) => {
        return reply.code(statusCode).type(contentType).sendFile(path, { contentType: false })
      })
    }

    await this.#app.ready()
  }
}

export class ViteSSRCapability extends NodeCapability {
  #basePath

  constructor (root, config, context) {
    super(root, config, context)
    this.type = 'vite'
  }

  _getWantsAbsoluteUrls () {
    return true
  }

  async init () {
    await super.init()

    const config = this.config

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

    await super._start({ listen })

    const config = this.config
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
          globalThis.platformatic.logger.error({ err: ensureLoggableError(e) }, 'Reading build info failed.')
        }
      }
    }

    await super.start({ listen })
    await super._listen()
  }

  async build () {
    const config = this.config
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

    let vite = dirname(resolvePackage(this.root, 'vite'))
    // In Vite 6, module resolving changed, adjust it
    if (!existsSync(resolve(vite, 'dist/node/index.js'))) {
      vite = resolve(vite, '../..')
    }

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
    const applicationBasePath = vite?.config?.base

    const gateway = {
      tcp: typeof this.url !== 'undefined',
      url: this.url,
      prefix: this.basePath ?? applicationBasePath ?? this.#basePath,
      wantsAbsoluteUrls: true,
      needsRootTrailingSlash: true
    }

    return { gateway }
  }

  _findEntrypoint () {
    const config = this.config.vite ?? {}
    return resolve(this.root, config.ssr.entrypoint)
  }
}

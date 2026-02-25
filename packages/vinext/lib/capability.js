import {
  BaseCapability,
  cleanBasePath,
  createServerListener,
  errors,
  getServerUrl,
  importFile,
  resolvePackageViaESM
} from '@platformatic/basic'
import { ensureLoggableError } from '@platformatic/foundation'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { satisfies } from 'semver'
import { version } from './schema.js'

const supportedVinextVersions = ['^0.0.5']
const supportedViteVersions = ['^7.0.0', '^8.0.0']

export class VinextCapability extends BaseCapability {
  #basePath
  #vinext
  #vite
  #app
  #server

  constructor (root, config, context) {
    super('vinext', version, root, config, context)
  }

  async init () {
    await super.init()

    const config = this.config
    this.#basePath = config.application?.basePath ? cleanBasePath(config.application?.basePath) : undefined

    this.registerGlobals({ basePath: this.#basePath })
    this.subprocessTerminationSignal = 'SIGKILL'

    this.#vinext = dirname(await resolvePackageViaESM(this.root, 'vinext'))
    this.#vite = dirname(await resolvePackageViaESM(this.root, 'vite'))

    // In Vite 6, module resolving changed, adjust it
    if (!existsSync(resolve(this.#vite, 'dist/node/index.js'))) {
      this.#vite = resolve(this.#vite, '../..')
    }

    this.#vinext = resolve(this.#vinext, '..')

    if (this.isProduction) {
      return
    }

    const vinextPackage = JSON.parse(await readFile(resolve(this.#vinext, 'package.json'), 'utf-8'))
    const vitePackage = JSON.parse(await readFile(resolve(this.#vite, 'package.json'), 'utf-8'))

    if (!supportedVinextVersions.some(v => satisfies(vinextPackage.version, v))) {
      throw new errors.UnsupportedVersion('vinext', vinextPackage.version, supportedVinextVersions)
    }

    if (!supportedViteVersions.some(v => satisfies(vitePackage.version, v))) {
      throw new errors.UnsupportedVersion('vite', vitePackage.version, supportedViteVersions)
    }
  }

  async start ({ listen }) {
    // Make this idempotent
    if (this.url) {
      return this.url
    }

    await super._start({ listen })

    const command = this.config.application.commands[this.isProduction ? 'production' : 'development']

    if (command) {
      return this.startWithCommand(command)
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
    }

    if (this.#app) {
      await this.#app.close()
      this.#app = null
    }

    if (this.#server?.listening) {
      await this._closeServer(this.#server)
    }

    this.#server = null
  }

  setClosing () {
    super.setClosing()

    const closeConnections = this.runtimeConfig?.gracefulShutdown?.closeConnections !== false
    if (!closeConnections) return

    // In production mode with Fastify, close HTTP/2 sessions
    if (this.isProduction && this.#server?.closeHttp2Sessions) {
      this.#server.closeHttp2Sessions()
    }

    // In development mode, Vite handles its own server
    if (!this.isProduction && this.#app?.httpServer?.closeHttp2Sessions) {
      this.#app.httpServer.closeHttp2Sessions()
    }
  }

  async build () {
    const command = this.config.application.commands.build

    if (command) {
      return this.buildWithCommand(command, this.#basePath)
    }

    await this.init()

    const { vite, vinext, clientOutputConfig, clientTreeshakeConfig } = await this.#importPackages()
    const config = this.#getViteConfig({}, vinext)

    let basePath
    let outDir

    config.plugins ??= []
    config.plugins.push({
      name: 'platformatic-build',
      configResolved: config => {
        basePath = cleanBasePath(config.base)
        outDir = resolve(this.root, config.build.outDir)
      }
    })

    try {
      globalThis.platformatic.isBuilding = true

      // App router
      if (existsSync(resolve(this.root, 'app')) || existsSync(resolve(this.root, 'src/app'))) {
        const builder = await vite.createBuilder(config)
        await builder.buildApp()
        // Pages router use split builds to generate client and server bundles separately
      } else {
        await vite.build({
          ...config,
          build: {
            outDir: 'dist/client',
            manifest: true,
            ssrManifest: true,
            rollupOptions: {
              input: 'virtual:vinext-client-entry',
              output: clientOutputConfig,
              treeshake: clientTreeshakeConfig
            }
          }
        })

        await vite.build({
          ...config,
          build: {
            outDir: 'dist/server',
            ssr: 'virtual:vinext-server-entry',
            rollupOptions: {
              output: {
                entryFileNames: 'entry.js'
              }
            }
          }
        })
      }
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

  getMeta (prefix) {
    const config = this.subprocessConfig ?? this.#app?.config

    const gateway = {
      tcp: typeof this.url !== 'undefined',
      url: this.url,
      prefix: cleanBasePath(this.basePath ?? config?.base ?? prefix ?? this.#basePath),
      wantsAbsoluteUrls: true,
      needsRootTrailingSlash: true
    }

    return { gateway }
  }

  _getApp () {
    return this.#app
  }

  _setApp (app) {
    this.#app = app
  }

  async #startDevelopment () {
    await this.init()

    const { vite, vinext } = await this.#importPackages()
    const { createServer } = vite

    const { hostname, port, backlog } = this.serverConfig ?? {}

    const serverOptions = {
      host: hostname || '127.0.0.1',
      port: port || 0,
      strictPort: false,
      hmr: true,
      allowedHosts: ['.plt.local'],
      fs: {
        strict: this.config.vinext.devServer.strict
      }
    }

    const serverPromise = createServerListener(
      (this.isEntrypoint ? serverOptions?.port : undefined) ?? true,
      (this.isEntrypoint ? serverOptions?.host : undefined) ?? true,
      typeof backlog === 'number' ? { backlog } : {}
    )

    this.#app = await createServer(this.#getViteConfig({ server: serverOptions }, vinext))
    await this.#app.listen()

    this.#server = await serverPromise
    this.url = getServerUrl(this.#server)
  }

  async #startProduction () {
    const outputDirectory = this.outputDirectory ?? resolve(this.root, this.config.application.outputDirectory)
    this.verifyOutputDirectory(outputDirectory)
    this.#basePath = await this.#getBasePathFromBuildInfo()

    const { hostname, port, backlog } = this.serverConfig ?? {}

    const serverPromise = createServerListener(
      (this.isEntrypoint ? port : undefined) ?? true,
      (this.isEntrypoint ? hostname : undefined) ?? true,
      typeof backlog === 'number' ? { backlog } : {}
    )

    const { startProdServer } = await importFile(await resolve(this.#vinext, 'dist/server/prod-server.js'))

    this.#server = await startProdServer({
      port: port || 0,
      host: hostname || '127.0.0.1',
      outDir: outputDirectory,
      noCompression: this.config.vinext.noCompression
    })

    // Ensure URL is aligned with listener capture (reuse-port/backlog aware).
    this.#server = await serverPromise
    this.url = getServerUrl(this.#server)
    return this.url
  }

  #getViteConfig (overrides, vinextPlugin) {
    const configCandidates = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs']

    if (typeof this.config.vinext.configFile === 'string') {
      configCandidates.unshift(resolve(this.root, this.config.vinext.configFile))
    }

    const configFile = configCandidates.find(file => existsSync(file))

    if (configFile) {
      return {
        root: this.root,
        base: this.#basePath,
        configFile,
        logLevel: this.logger.level,
        clearScreen: false,
        optimizeDeps: { force: false },
        ...overrides
      }
    }

    return {
      root: this.root,
      base: this.#basePath,
      configFile: false,
      logLevel: this.logger.level,
      clearScreen: false,
      optimizeDeps: { force: false },
      plugins: vinextPlugin ? [vinextPlugin({ appDir: this.root })] : [],
      resolve: {
        dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime']
      },
      ...overrides
    }
  }

  async #importPackages () {
    const vite = await importFile(resolve(this.#vite, 'dist/node/index.js'))
    const {
      default: vinext,
      clientOutputConfig,
      clientTreeshakeConfig
    } = await importFile(resolve(this.#vinext, 'dist/index.js'))

    return { vite, vinext, clientOutputConfig, clientTreeshakeConfig }
  }

  async #getBasePathFromBuildInfo () {
    const config = this.config
    const outputDirectory = this.outputDirectory ?? resolve(this.root, config.application.outputDirectory)
    const buildInfoPath = this.buildInfoPath ?? resolve(outputDirectory, '.platformatic-build.json')

    if (!this.#basePath && existsSync(buildInfoPath)) {
      try {
        const buildInfo = JSON.parse(await readFile(buildInfoPath, 'utf-8'))
        this.#basePath = buildInfo.basePath
      } catch (e) {
        globalThis.platformatic.logger.error({ err: ensureLoggableError(e) }, 'Reading build info failed.')
      }
    }

    return this.#basePath
  }
}

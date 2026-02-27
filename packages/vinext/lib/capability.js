import {
  BaseCapability,
  ChildManager,
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
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { satisfies } from 'semver'
import { version } from './schema.js'

const supportedVinextVersions = ['^0.0.5']
const supportedViteVersions = ['^7.0.0', '^8.0.0']

export function getCacheHandlerPath (name) {
  return fileURLToPath(new URL(`./caching/${name}.js`, import.meta.url)).replaceAll(sep, '/')
}

export class VinextCapability extends BaseCapability {
  #basePath
  #loaderUrl
  #vinext
  #vite
  #nextConfig
  #app
  #server

  constructor (root, config, context) {
    super('vinext', version, root, config, context)

    this.#loaderUrl = new URL('./loader.js', import.meta.url)
  }

  async init () {
    await super.init()

    const config = this.config
    this.#basePath = config.application?.basePath ? cleanBasePath(config.application?.basePath) : undefined

    this.registerGlobals({ basePath: this.#basePath, config: this.config })
    this.subprocessTerminationSignal = 'SIGKILL'

    // This is needed here since apparently resolving the package executes some Vinext code
    // and thus our cache patch would be skipped.
    this.childManager = this.#createChildManager(this.#loaderUrl, await this.getChildManagerContext(this.#basePath))
    this.childManager.register()

    this.#vinext = resolve(dirname(await resolvePackageViaESM(this.root, 'vinext')), '..')
    this.#vite = resolve(dirname(await resolvePackageViaESM(this.root, 'vite')), '../..')

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
      this.#basePath = await this.#getBasePathFromBuildInfo()
      return this.startWithCommand(command, this.#loaderUrl)
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

    globalThis.platformatic.events.emit('plt:vinext:close')

    const command = this.config.application.commands[this.isProduction ? 'production' : 'development']
    if (command && this.childManager) {
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
    if (!closeConnections) {
      return
    }

    // In production mode, close HTTP/2 sessions if available on the server
    if (this.isProduction && this.#server?.closeHttp2Sessions) {
      this.#server.closeHttp2Sessions()
    }

    // In development mode, Vite handles its own server
    if (!this.isProduction && this.#app?.httpServer?.closeHttp2Sessions) {
      this.#app.httpServer.closeHttp2Sessions()
    }
  }

  async build () {
    await this.init()

    const command = this.config.application.commands.build

    if (command) {
      let config
      this.once('application:worker:event:vite:config', _config => {
        config = _config
      })

      await this.buildWithCommand(command, this.#basePath, {
        loader: new URL('./loader.js', import.meta.url),
        context: await this.getChildManagerContext(this.#basePath)
      })

      if (config) {
        const basePath = cleanBasePath(config.base)
        const outDir = resolve(this.root, config.build.outDir)

        await writeFile(resolve(outDir, '.platformatic-build.json'), JSON.stringify({ basePath }), 'utf-8')
      }

      return
    }

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

  async getChildManagerContext (basePath) {
    const context = await super.getChildManagerContext(basePath)

    context.wantsAbsoluteUrls = true

    return context
  }

  notifyConfig (config) {
    super.notifyConfig(config)
    this.#nextConfig = config
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

    // RSC in Vinext needs to point to src, if available
    let appDir = this.root
    if (existsSync(resolve(this.root, 'src'))) {
      appDir = resolve(this.root, 'src')
    }

    return {
      root: this.root,
      base: this.#basePath,
      configFile: false,
      logLevel: this.logger.level,
      clearScreen: false,
      optimizeDeps: { force: false },
      plugins: [vinextPlugin ? vinextPlugin({ appDir }) : null, this.#vinextPatcher()],
      resolve: {
        dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime']
      },
      ...overrides
    }
  }

  #createChildManager (loader, context, scripts) {
    const childManager = new ChildManager({
      loader,
      context,
      scripts
    })

    this.setupChildManagerEventsForwarding(childManager)
    return childManager
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

  #vinextPatcher () {
    function createSnippet (path) {
      return `
        const {setCacheHandler} = await import("next/cache");
        const {CacheHandler} = await import("${path}");
        const pltCacheHandler = new CacheHandler()
                
        globalThis.platformatic.events.on('plt:vinext:close', () => {
          pltCacheHandler.close()
        });
        
        setCacheHandler(pltCacheHandler);
      `
    }

    const resolveCacheHandlerPath = () => {
      let adapter = null

      if (this.#nextConfig?.cacheHandler) {
        adapter = 'isr'
      } else if (this.#nextConfig?.cacheComponents) {
        adapter = 'components'
      }

      return adapter ? getCacheHandlerPath(`${this.config.cache.adapter}-${adapter}`) : null
    }

    function needsPatching (id) {
      const cleanId = id.startsWith('\0') ? id.slice(1) : id

      // Inject into vinext-generated entries that run server-side
      return (
        cleanId === 'virtual:vinext-rsc-entry' ||
        cleanId === 'virtual:vinext-app-ssr-entry' ||
        cleanId === 'virtual:vinext-server-entry'
      )
    }

    return {
      name: 'plt-vinext-patcher',
      enforce: 'post',
      transform (code, id) {
        if (!needsPatching(id)) {
          return null
        }

        const adapter = resolveCacheHandlerPath()

        if (!adapter) {
          return null
        }

        const snippet = createSnippet(adapter)

        if (code.includes(snippet)) {
          return null
        }

        return { code: snippet + '\n' + code, map: null }
      }
    }
  }
}

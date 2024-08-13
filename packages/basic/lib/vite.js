import { createRequire } from 'node:module'
import { dirname, resolve as pathResolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { satisfies } from 'semver'
import { BaseStackable } from './base.js'
import { createPortManager, getServerUrl } from './utils.js'

import { readFile } from 'node:fs/promises'
import { UnsupportedVersion } from './errors.js'

const supportedVersions = '^5.0.0'

export class ViteStackable extends BaseStackable {
  #vite
  #app
  #server

  constructor (options, root, configManager) {
    super(options, root, configManager)
    this.type = 'vite'
  }

  async init () {
    globalThis[Symbol.for('plt.runtime.itc')].handle('getServiceMeta', this.getMeta.bind(this))

    this.#vite = dirname(createRequire(this.root).resolve('vite'))
    const vitePackage = JSON.parse(await readFile(pathResolve(this.#vite, 'package.json')))

    if (!satisfies(vitePackage.version, supportedVersions)) {
      throw new UnsupportedVersion('vite', vitePackage.version, supportedVersions)
    }
  }

  async start () {
    // Make this idempotent
    if (this.url) {
      return this.url
    }

    const config = this.configManager.current

    // Prepare options
    const { hostname, port, https, cors } = this.serverConfig ?? {}
    const configFile = config.vite?.configFile ? pathResolve(this.root, config.vite?.configFile) : undefined
    const basePath = config.application?.base
      ? `/${config.application?.base}`.replaceAll(/\/+/g, '/').replace(/\/$/, '')
      : undefined

    const serverOptions = {
      host: hostname || '127.0.0.1',
      port: port || 0,
      strictPort: false,
      https,
      cors,
      origin: 'http://localhost',
      hmr: true,
    }

    // Require Vite
    const portManager = createPortManager()
    const { createServer } = await import(pathToFileURL(pathResolve(this.#vite, 'dist/node/index.js')))

    // Create the server and listen
    this.#app = await createServer({
      root: this.root,
      base: basePath,
      mode: 'development',
      configFile,
      logLevel: this.logger.level,
      clearScreen: false,
      optimizeDeps: { force: false },
      server: serverOptions,
    })

    await this.#app.listen()
    this.#server = this.#app.httpServer
    this.url = getServerUrl(this.#server)
    portManager?.destroy()
  }

  async stop () {
    return this.#app.close()
  }

  async getWatchConfig () {
    return {
      enabled: false,
    }
  }

  getMeta () {
    return {
      composer: {
        tcp: true,
        url: this.url,
        prefix: this.#app.config.base.replace(/(^\/)|(\/$)/g, ''),
        wantsAbsoluteUrls: true,
      },
    }
  }
}

import { BaseStackable, createServerListener, errors, getServerUrl, importFile } from '@platformatic/basic'
import { ConfigManager } from '@platformatic/config'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
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
    globalThis[Symbol.for('plt.runtime.itc')].handle('getServiceMeta', this.getMeta.bind(this))

    this.#vite = dirname(createRequire(this.root).resolve('vite'))
    const vitePackage = JSON.parse(await readFile(resolve(this.#vite, 'package.json')))

    /* c8 ignore next 3 */
    if (!satisfies(vitePackage.version, supportedVersions)) {
      throw new errors.UnsupportedVersion('vite', vitePackage.version, supportedVersions)
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
    const configFile = config.vite?.configFile ? resolve(this.root, config.vite?.configFile) : undefined
    const basePath = config.application?.basePath
      ? `/${config.application?.basePath}`.replaceAll(/\/+/g, '/').replace(/\/$/, '')
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
    const serverPromise = createServerListener()
    const { createServer } = await importFile(resolve(this.#vite, 'dist/node/index.js'))

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
    this.#server = await serverPromise
    this.url = getServerUrl(this.#server)
  }

  async stop () {
    return this.#app.close()
  }

  /* c8 ignore next 5 */
  async getWatchConfig () {
    return {
      enabled: false,
    }
  }

  getMeta () {
    if (!this.#basePath) {
      this.#basePath = this.#app.config.base.replace(/(^\/)|(\/$)/g, '')
    }

    return {
      composer: {
        tcp: true,
        url: this.url,
        prefix: this.#basePath,
        wantsAbsoluteUrls: true,
      },
    }
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
}

export async function buildStackable (opts) {
  const root = opts.context.directory

  const configManager = new ConfigManager({ schema, source: opts.config ?? {}, transformConfig })
  await configManager.parseAndValidate()

  return new ViteStackable(opts, root, configManager)
}

export default {
  configType: 'vite',
  configManagerConfig: {
    transformConfig,
  },
  buildStackable,
  schema,
  version: packageJson.version,
}

import { BaseStackable, createServerListener, errors, getServerUrl, importFile } from '@platformatic/basic'
import { ConfigManager } from '@platformatic/config'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { satisfies } from 'semver'
import { packageJson, schema } from './lib/schema.js'

const supportedVersions = '^4.0.0'

export class AstroStackable extends BaseStackable {
  #astro
  #app
  #server
  #basePath

  constructor (options, root, configManager) {
    super('astro', packageJson.version, options, root, configManager)
  }

  async init () {
    globalThis[Symbol.for('plt.runtime.itc')].handle('getServiceMeta', this.getMeta.bind(this))

    this.#astro = resolve(dirname(createRequire(this.root).resolve('astro')), '../..')
    const astroPackage = JSON.parse(await readFile(resolve(this.#astro, 'package.json'), 'utf-8'))

    /* c8 ignore next 3 */
    if (!satisfies(astroPackage.version, supportedVersions)) {
      throw new errors.UnsupportedVersion('astro', astroPackage.version, supportedVersions)
    }
  }

  async start () {
    // Make this idempotent
    if (this.url) {
      return this.url
    }

    const config = this.configManager.current

    // Prepare options
    const { hostname, port } = this.serverConfig ?? {}
    const configFile = config.astro?.configFile // Note: Astro expect this to be a relative path to the root
    const basePath = config.application?.basePath
      ? `/${config.application?.basePath}`.replaceAll(/\/+/g, '/').replace(/\/$/, '')
      : undefined

    const serverOptions = {
      host: hostname || '127.0.0.1',
      port: port || 0
    }

    // Require Vite
    const serverPromise = createServerListener()
    const { dev } = await importFile(resolve(this.#astro, 'dist/core/index.js'))

    // Create the server and listen
    this.#app = await dev({
      root: this.root,
      base: basePath,
      mode: 'development',
      configFile,
      logLevel: this.logger.level,
      server: serverOptions,
      integrations: [
        {
          name: 'platformatic',
          hooks: {
            'astro:config:setup': ({ config }) => {
              this.#basePath = config.base.replace(/(^\/)|(\/$)/g, '')

              /*
                As Astro generates invalid paths in development mode which ignore the basePath
                (see https://github.com/withastro/astro/issues/11445), make sure we provide
                the prefix in HMR path.
              */
              config.vite.server ??= {}
              config.vite.server.hmr ??= {}
              config.vite.server.hmr.path = `/${this.#basePath}/`.replaceAll(/\/+/g, '/')
            }
          }
        }
      ]
    })

    this.#server = await serverPromise
    this.url = getServerUrl(this.#server)
  }

  async stop () {
    return this.#app.stop()
  }

  /* c8 ignore next 5 */
  async getWatchConfig () {
    return {
      enabled: false
    }
  }

  getMeta () {
    return {
      composer: {
        tcp: true,
        url: this.url,
        prefix: this.#basePath,
        wantsAbsoluteUrls: true
      }
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

  return new AstroStackable(opts, root, configManager)
}

export default {
  configType: 'astro',
  configManagerConfig: {
    transformConfig
  },
  buildStackable,
  schema,
  version: packageJson.version
}

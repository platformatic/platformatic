import { BaseStackable, ChildManager, errors, importFile } from '@platformatic/basic'
import { ConfigManager } from '@platformatic/config'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve as pathResolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { satisfies } from 'semver'
import { packageJson, schema } from './lib/schema.js'

const supportedVersions = '^14.0.0'

export class NextStackable extends BaseStackable {
  #basePath
  #next
  #manager

  constructor (options, root, configManager) {
    super('vite', packageJson.version, options, root, configManager)
  }

  async init () {
    globalThis[Symbol.for('plt.runtime.itc')].handle('getServiceMeta', this.getMeta.bind(this))

    this.#next = pathResolve(dirname(createRequire(this.root).resolve('next')), '../..')
    const nextPackage = JSON.parse(await readFile(pathResolve(this.#next, 'package.json')))

    /* c8 ignore next 3 */
    if (!satisfies(nextPackage.version, supportedVersions)) {
      throw new errors.UnsupportedVersion('next', nextPackage.version, supportedVersions)
    }
  }

  async start () {
    // Make this idempotent
    if (this.url) {
      return this.url
    }

    const config = this.configManager.current
    const require = createRequire(this.root)
    const nextRoot = require.resolve('next')

    const { hostname, port } = this.serverConfig ?? {}
    const serverOptions = {
      host: hostname || '127.0.0.1',
      port: port || 0,
    }

    this.#basePath = config.application?.basePath
      ? `/${config.application?.basePath}`.replaceAll(/\/+/g, '/').replace(/\/$/, '')
      : ''

    this.#manager = new ChildManager({
      loader: new URL('./lib/loader.js', import.meta.url),
      context: {
        // Always use URL to avoid serialization problem in Windows
        root: pathToFileURL(this.root),
        basePath: this.#basePath,
        logger: { id: this.id, level: this.logger.level },
      },
    })

    this.#manager.on('config', config => {
      this.#basePath = config.basePath.replace(/(^\/)|(\/$)/g, '')
    })

    const promise = once(this.#manager, 'url')
    await this.#startNext(nextRoot, serverOptions)
    this.url = (await promise)[0]
  }

  async stop () {
    const exitPromise = once(this.#manager, 'exit')

    this.#manager.close()
    await exitPromise
  }

  /* c8 ignore next 5 */
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
        prefix: this.#basePath,
        wantsAbsoluteUrls: true,
      },
    }
  }

  async #startNext (nextRoot, serverOptions) {
    const { nextDev } = await importFile(pathResolve(this.#next, './dist/cli/next-dev.js'))

    this.#manager.inject()
    await nextDev(serverOptions, 'default', this.root)
    this.#manager.eject()
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

  return new NextStackable(opts, root, configManager)
}

export default {
  configType: 'next',
  configManagerConfig: {
    transformConfig,
  },
  buildStackable,
  schema,
  version: packageJson.version,
}

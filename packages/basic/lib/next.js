import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve as pathResolve } from 'node:path'
import { satisfies } from 'semver'
import { BaseStackable } from './base.js'
import { UnsupportedVersion } from './errors.js'
import { importFile } from './utils.js'
import { ChildManager } from './worker/child-manager.js'

const supportedVersions = '^14.0.0'

export class NextStackable extends BaseStackable {
  #basePath
  #next
  #manager

  constructor (options, root, configManager) {
    super(options, root, configManager)
    this.type = 'next'
  }

  async init () {
    globalThis[Symbol.for('plt.runtime.itc')].handle('getServiceMeta', this.getMeta.bind(this))

    this.#next = pathResolve(dirname(createRequire(this.root).resolve('next')), '../..')
    const nextPackage = JSON.parse(await readFile(pathResolve(this.#next, 'package.json')))

    if (!satisfies(nextPackage.version, supportedVersions)) {
      throw new UnsupportedVersion('next', nextPackage.version, supportedVersions)
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

    this.#basePath = config.application?.base
      ? `/${config.application?.base}`.replaceAll(/\/+/g, '/').replace(/\/$/, '')
      : ''

    this.#manager = new ChildManager({
      loader: new URL('./worker/next-loader.js', import.meta.url),
      context: {
        root: this.root,
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

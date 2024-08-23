import { errors, importFile } from '@platformatic/basic'
import { ConfigManager } from '@platformatic/config'
import { ViteStackable } from '@platformatic/vite'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { satisfies } from 'semver'
import { packageJson, schema } from './lib/schema.js'

const supportedVersions = '^2.0.0'

export class RemixStackable extends ViteStackable {
  #remix
  #basePath

  constructor (options, root, configManager) {
    super(options, root, configManager)

    this.type = 'remix'
    this.version = packageJson.version
  }

  async init () {
    await super.init()

    this.#remix = resolve(dirname(createRequire(this.root).resolve('@remix-run/dev')), '..')
    const remixPackage = JSON.parse(await readFile(resolve(this.#remix, 'package.json'), 'utf-8'))

    /* c8 ignore next 3 */
    if (!satisfies(remixPackage.version, supportedVersions)) {
      throw new errors.UnsupportedVersion('@remix-run/dev', remixPackage.version, supportedVersions)
    }

    const config = this.configManager.current
    this.#basePath = config.application?.basePath
      ? `/${config.application?.basePath}`.replaceAll(/\/+/g, '/').replace(/\/$/, '')
      : ''

    this.registerGlobals({
      // Always use URL to avoid serialization problem in Windows
      root: pathToFileURL(this.root),
      basePath: this.#basePath,
      logger: { id: this.id, level: this.logger.level }
    })
  }

  async start ({ listen }) {
    // Make this idempotent
    if (this.url) {
      return this.url
    }

    const { preloadViteEsm } = await importFile(resolve(this.#remix, './dist/vite/import-vite-esm-sync.js'))
    await preloadViteEsm()
    await super.start({ listen })

    /* c8 ignore next 3 */
    if (!this._getVite().config.plugins.some(p => p.name === 'remix')) {
      this.logger.warn('Could not find Remix plugin in your Vite configuration. Contuining as plain Vite application.')
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

  return new RemixStackable(opts, root, configManager)
}

export default {
  configType: 'remix',
  configManagerConfig: {
    transformConfig
  },
  buildStackable,
  schema,
  version: packageJson.version
}

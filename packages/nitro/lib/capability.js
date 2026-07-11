import {
  BaseCapability,
  buildAdditionalServerOptions,
  cleanBasePath,
  createServerListener,
  ensureTrailingSlash,
  errors,
  getServerUrl,
  importFile,
  injectViaRequest,
  resolvePackageViaESM
} from '@platformatic/basic'
import { hasDependency, sanitizeHTTPSArgument, sanitizeHTTPSOptions } from '@platformatic/foundation'
import { updateGlobals } from '@platformatic/globals'
import { ViteCapability } from '@platformatic/vite'
import inject from 'light-my-request'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { satisfies } from 'semver'
import { version } from './schema.js'

export const supportedVersions = {
  nitro: '>=3.0.0-alpha.0 <4.0.0',
  nitropack: '^2.10.0'
}

const viteConfigFiles = [
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
  'vite.config.ts',
  'vite.config.mts',
  'vite.config.cts'
]

// Lovable and other Nitro based applications built on Vite use Nitro as a Vite plugin,
// while standalone Nitro applications are driven by the Nitro CLI directly.
export function hasViteConfigFile (root, config) {
  const configFile = config?.vite?.configFile

  if (typeof configFile === 'string') {
    return existsSync(resolve(root, configFile))
  }

  return viteConfigFiles.some(file => existsSync(resolve(root, file)))
}

async function resolveNitroPackage (root) {
  let names = ['nitro', 'nitropack']

  // Prefer the package declared in the application package.json
  try {
    const applicationPackageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf-8'))
    const declared = names.filter(name => hasDependency(applicationPackageJson, name))

    if (declared.length > 0) {
      names = declared
    }
  } catch {
    // No-op, use the default order
  }

  for (const name of names) {
    let entry
    try {
      entry = await resolvePackageViaESM(root, name)
    } catch {
      continue
    }

    // Walk up from the entry point until we find the package root
    let packageRoot = dirname(entry)
    while (true) {
      const packageJsonPath = resolve(packageRoot, 'package.json')

      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))

        if (packageJson.name === name) {
          return { name, root: packageRoot, packageJson }
        }
      }

      const parent = dirname(packageRoot)
      /* c8 ignore next 3 */
      if (parent === packageRoot) {
        break
      }

      packageRoot = parent
    }
  }

  throw new Error('Cannot find the "nitro" or "nitropack" package. Please add it to the application dependencies.')
}

function checkNitroVersion (nitroPackage) {
  const range = supportedVersions[nitroPackage.name]

  if (!satisfies(nitroPackage.packageJson.version, range, { includePrerelease: true })) {
    throw new errors.UnsupportedVersion(nitroPackage.name, nitroPackage.packageJson.version, range)
  }
}

async function startNitroProductionServer (capability, serverConfig, outputDirectory) {
  capability.verifyOutputDirectory(outputDirectory)

  const serverPromise = createServerListener(
    serverConfig?.port ?? true,
    serverConfig?.hostname ?? true,
    await buildAdditionalServerOptions(serverConfig)
  )

  const httpsOptions = await sanitizeHTTPSOptions(serverConfig?.https)

  if (!httpsOptions?.cert && !httpsOptions?.key) {
    await importFile(resolve(outputDirectory, 'server/index.mjs'))
  } else {
    const originalCert = process.env.NITRO_SSL_CERT
    const originalKey = process.env.NITRO_SSL_KEY

    process.env.NITRO_SSL_CERT = serializeCertificateValue(httpsOptions.cert)
    process.env.NITRO_SSL_KEY = serializeCertificateValue(httpsOptions.key)

    try {
      await importFile(resolve(outputDirectory, 'server/index.mjs'))
    } finally {
      restoreEnvironmentVariable('NITRO_SSL_CERT', originalCert)
      restoreEnvironmentVariable('NITRO_SSL_KEY', originalKey)
    }
  }

  const server = await serverPromise
  return { server, dispatcher: server.listeners('request')[0], url: getServerUrl(server) }
}

function serializeCertificateValue (value) {
  if (Array.isArray(value)) {
    return value.map(item => item.toString()).join('\n')
  }

  return value.toString()
}

function restoreEnvironmentVariable (key, originalValue) {
  if (typeof originalValue === 'undefined') {
    delete process.env[key]
  } else {
    process.env[key] = originalValue
  }
}

// Standalone Nitro applications, driven via the Nitro CLI in development
export class NitroCapability extends BaseCapability {
  #nitro
  #basePath
  #server
  #dispatcher

  constructor (root, config, context) {
    super('nitro', version, root, config, context)
    this.exitOnUnhandledErrors = false
    this.subprocessTerminationSignal = 'SIGKILL'
  }

  async init () {
    await super.init()

    if (!this.isProduction) {
      this.#nitro = await resolveNitroPackage(this.root)
      checkNitroVersion(this.#nitro)
    }

    this.#basePath = this.config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(this.config.application.basePath))
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

    const command = this.config.application.commands[this.isProduction ? 'production' : 'development']

    if (command) {
      return this.startWithCommand(command)
    }

    if (!this.isProduction) {
      await this.#startDevelopment()
    } else {
      await this.#startProduction()
    }

    await this._collectMetrics()
  }

  async stop () {
    await super.stop()

    if (this.childManager) {
      return this.stopCommand()
    }

    /* c8 ignore next 3 */
    if (!this.#server?.listening) {
      return
    }

    return this._closeServer(this.#server)
  }

  async build () {
    if (!this.#nitro) {
      await this.init()
    }

    const config = this.config
    const cli = resolve(this.#nitro.root, 'dist/cli/index.mjs')

    return this.buildWithCommand(config.application.commands.build ?? `node ${cli} build`, this.#basePath)
  }

  async inject (injectParams, onInject) {
    if (!this.isProduction) {
      return injectViaRequest(this.url, injectParams, onInject)
    }

    const res = await inject(this.#dispatcher, injectParams, onInject)

    /* c8 ignore next 3 */
    if (onInject) {
      return
    }

    const { statusCode, headers, body, payload, rawPayload } = res
    return { statusCode, headers, body, payload, rawPayload }
  }

  getMeta () {
    const hasBasePath = this.basePath || this.#basePath

    return {
      gateway: {
        tcp: typeof this.url !== 'undefined',
        url: this.url,
        prefix: this.basePath ?? this.#basePath,
        wantsAbsoluteUrls: !!hasBasePath,
        needsRootTrailingSlash: false
      }
    }
  }

  /* c8 ignore next 5 */
  async getWatchConfig () {
    return {
      enabled: false
    }
  }

  async #startDevelopment () {
    let { hostname, port, https } = this.serverConfig ?? {}
    hostname ||= '127.0.0.1'
    port ||= 0
    let httpsArgs = ''

    // The --https options are only supported by Nitro v2 (nitropack)
    if (https && this.#nitro.name === 'nitropack') {
      httpsArgs = ' --https'

      const key = await sanitizeHTTPSArgument(https.key, true)
      const cert = await sanitizeHTTPSArgument(https.cert, true)

      if (https.key) {
        httpsArgs += ` --https.key ${resolve(this.root, key)}`
      }

      if (https.cert) {
        httpsArgs += ` --https.cert ${resolve(this.root, cert)}`
      }
    }

    const cli = resolve(this.#nitro.root, 'dist/cli/index.mjs')
    await this.startWithCommand(`node ${cli} dev --port ${port} --host ${hostname}${httpsArgs}`)

    if (https) {
      this.url = this.url.replace(/^http:/, 'https:')
    }

    return this.url
  }

  async #startProduction () {
    const outputDirectory = resolve(this.root, this.config.nitro?.outputDirectory ?? '.output')

    const { server, dispatcher, url } = await startNitroProductionServer(this, this.serverConfig, outputDirectory)
    this.#server = server
    this.#dispatcher = dispatcher
    this.url = url

    return this.url
  }
}

// Nitro used as a Vite plugin, which is how Lovable applications are structured.
// In development we run the regular Vite dev server, while in production we run
// the Nitro server generated by "vite build".
export class NitroViteCapability extends ViteCapability {
  #nitro
  #basePath
  #server
  #dispatcher

  constructor (root, config, context) {
    super(root, config, context)
    this.type = 'nitro'
    this.version = version
    this.exitOnUnhandledErrors = false
    this.subprocessTerminationSignal = 'SIGKILL'
  }

  async init () {
    await super.init()

    if (!this.isProduction) {
      this.#nitro = await resolveNitroPackage(this.root)
      checkNitroVersion(this.#nitro)
    }

    this.#basePath = this.config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(this.config.application.basePath))
      : undefined

    this.registerGlobals({ basePath: this.#basePath })
  }

  async start ({ listen }) {
    // Make this idempotent
    /* c8 ignore next 3 */
    if (this.url) {
      return this.url
    }

    if (!this.isProduction) {
      await super.start({ listen })

      const plugins = this._getApp()?.config?.plugins ?? []
      if (!this.childManager && !plugins.some(plugin => plugin.name?.startsWith('nitro'))) {
        this.logger.warn('Could not find the Nitro plugin in your Vite configuration. Continuing as a plain Vite application.')
      }

      return this.url
    }

    await this._start({ listen })

    const command = this.config.application.commands.production

    if (command) {
      return this.startWithCommand(command)
    }

    await this.#startProduction()
    await this._collectMetrics()

    return this.url
  }

  async stop () {
    await super.stop()

    /* c8 ignore next 3 */
    if (!this.#server?.listening) {
      return
    }

    return this._closeServer(this.#server)
  }

  async build () {
    if (!this.isProduction && !this.#nitro) {
      await this.init()
    }

    const config = this.config
    const command = config.application.commands.build

    if (command) {
      return this.buildWithCommand(command, this.#basePath)
    }

    const configFile = config.vite.configFile ? resolve(this.root, config.vite.configFile) : undefined
    const { build, createBuilder } = await importFile(resolve(this._getViteModule(), 'dist/node/index.js'))

    try {
      updateGlobals({ isBuilding: true })

      // Note that we purposely don't override the output directory here as it is managed by Nitro
      const buildOptions = {
        root: this.root,
        base: this.#basePath,
        mode: 'production',
        configFile,
        logLevel: this.logger.level
      }

      /* c8 ignore next 5 */
      if (createBuilder) {
        const builder = await createBuilder(buildOptions, null)
        await builder.buildApp()
      } else {
        await build(buildOptions)
      }
    } finally {
      updateGlobals({ isBuilding: false })
    }
  }

  async inject (injectParams, onInject) {
    if (!this.isProduction) {
      return injectViaRequest(this.url, injectParams, onInject)
    }

    const res = await inject(this.#dispatcher, injectParams, onInject)

    /* c8 ignore next 3 */
    if (onInject) {
      return
    }

    const { statusCode, headers, body, payload, rawPayload } = res
    return { statusCode, headers, body, payload, rawPayload }
  }

  getMeta () {
    if (!this.isProduction) {
      return super.getMeta()
    }

    const hasBasePath = this.basePath || this.#basePath

    return {
      gateway: {
        tcp: typeof this.url !== 'undefined',
        url: this.url,
        prefix: this.basePath ?? this.#basePath,
        wantsAbsoluteUrls: !!hasBasePath,
        needsRootTrailingSlash: false
      }
    }
  }

  async #startProduction () {
    const outputDirectory = resolve(this.root, this.config.nitro?.outputDirectory ?? '.output')

    const { server, dispatcher, url } = await startNitroProductionServer(this, this.serverConfig, outputDirectory)
    this.#server = server
    this.#dispatcher = dispatcher
    this.url = url

    return this.url
  }
}

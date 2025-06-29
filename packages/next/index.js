import {
  BaseStackable,
  transformConfig as basicTransformConfig,
  ChildManager,
  cleanBasePath,
  createChildProcessListener,
  createServerListener,
  errors,
  getServerUrl,
  importFile,
  resolvePackage,
  schemaOptions
} from '@platformatic/basic'
import { ConfigManager } from '@platformatic/config'
import { ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { dirname, resolve as pathResolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse, satisfies } from 'semver'
import { packageJson, schema } from './lib/schema.js'

const supportedVersions = ['^14.0.0', '^15.0.0']

export * as cachingValkey from './lib/caching/valkey.js'

export class NextStackable extends BaseStackable {
  #basePath
  #next
  #nextVersion
  #child
  #server

  constructor (options, root, configManager) {
    super('next', packageJson.version, options, root, configManager)
  }

  async init () {
    await super.init()

    // This is needed to avoid Next.js to throw an error when the lockfile is not correct
    // and the user is using npm but has pnpm in its $PATH.
    //
    // See: https://github.com/platformatic/composer-next-node-fastify/pull/3
    //
    // PS by Paolo: Sob.
    process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = 'true'

    this.#next = pathResolve(dirname(resolvePackage(this.root, 'next')), '../..')
    const nextPackage = JSON.parse(await readFile(pathResolve(this.#next, 'package.json'), 'utf-8'))
    this.#nextVersion = parse(nextPackage.version)

    if (this.#nextVersion.major < 15 || (this.#nextVersion.major <= 15 && this.#nextVersion.minor < 1)) {
      await import('./lib/create-context-patch.js')
    }

    /* c8 ignore next 3 */
    if (!supportedVersions.some(v => satisfies(nextPackage.version, v))) {
      throw new errors.UnsupportedVersion('next', nextPackage.version, supportedVersions)
    }
  }

  async start ({ listen }) {
    // Make this idempotent
    if (this.url) {
      return this.url
    }

    this.on('config', config => {
      this.#basePath = config.basePath
    })

    if (this.isProduction) {
      await this.#startProduction(listen)
    } else {
      await this.#startDevelopment(listen)
    }

    await this._collectMetrics()
  }

  async stop () {
    if (this.subprocess) {
      return this.stopCommand()
    }

    globalThis.platformatic.events.emit('plt:next:close')

    if (this.isProduction) {
      await new Promise((resolve, reject) => {
        this.#server.close(error => {
          /* c8 ignore next 3 */
          if (error) {
            return reject(error)
          }

          resolve()
        })
      })

      await this.childManager.close()
    } else {
      const exitPromise = once(this.#child, 'exit')
      await this.childManager.close()
      process.kill(this.#child.pid, 'SIGKILL')
      await exitPromise
    }
  }

  async build () {
    if (!this.#nextVersion) {
      await this.init()
    }

    const config = this.configManager.current
    const loader = new URL('./lib/loader.js', import.meta.url)
    this.#basePath = config.application?.basePath ? cleanBasePath(config.application?.basePath) : ''

    let command = config.application.commands.build

    if (!command) {
      await this.init()
      command = ['node', pathResolve(this.#next, './dist/bin/next'), 'build', this.root]
    }

    return this.buildWithCommand(command, this.#basePath, { loader, scripts: this.#getChildManagerScripts() })
  }

  /* c8 ignore next 5 */
  async getWatchConfig () {
    return {
      enabled: false,
      path: this.root
    }
  }

  getMeta () {
    const composer = { prefix: this.basePath ?? this.#basePath, wantsAbsoluteUrls: true, needsRootTrailingSlash: false }

    if (this.url) {
      composer.tcp = true
      composer.url = this.url
    }

    return { composer }
  }

  async #startDevelopment () {
    const config = this.configManager.current
    const loaderUrl = new URL('./lib/loader.js', import.meta.url)
    const command = this.configManager.current.application.commands.development

    this.#basePath = config.application?.basePath ? cleanBasePath(config.application?.basePath) : ''

    if (command) {
      return this.startWithCommand(command, loaderUrl, this.#getChildManagerScripts())
    }

    const { hostname, port } = this.serverConfig ?? {}
    const serverOptions = {
      host: hostname || '127.0.0.1',
      port: port || 0
    }

    const context = await this.getChildManagerContext(this.#basePath)

    this.childManager = new ChildManager({
      loader: loaderUrl,
      context: {
        ...context,
        port: false,
        wantsAbsoluteUrls: true
      },
      scripts: this.#getChildManagerScripts()
    })

    const promise = once(this.childManager, 'url')
    await this.#startDevelopmentNext(serverOptions)
    const [url, clientWs] = await promise
    this.url = url
    this.clientWs = clientWs
  }

  async #startDevelopmentNext (serverOptions) {
    const { nextDev } = await importFile(pathResolve(this.#next, './dist/cli/next-dev.js'))

    try {
      await this.childManager.inject()
      const childPromise = createChildProcessListener()

      this.#ensurePipeableStreamsInFork()

      if (this.#nextVersion.major === 14 && this.#nextVersion.minor < 2) {
        await nextDev({
          '--hostname': serverOptions.host,
          '--port': serverOptions.port,
          _: [this.root]
        })
      } else {
        await nextDev(serverOptions, 'default', this.root)
      }

      this.#child = await childPromise
      this.#child.stdout.setEncoding('utf8')
      this.#child.stderr.setEncoding('utf8')

      this.#child.stdout.pipe(process.stdout, { end: false })
      this.#child.stderr.pipe(process.stderr, { end: false })
    } finally {
      await this.childManager.eject()
    }
  }

  async #startProduction (listen) {
    const config = this.configManager.current
    const loaderUrl = new URL('./lib/loader.js', import.meta.url)
    const command = this.configManager.current.application.commands.production

    this.#basePath = config.application?.basePath ? cleanBasePath(config.application?.basePath) : ''

    if (command) {
      const childManagerScripts = this.#getChildManagerScripts()

      if (this.#nextVersion.major < 15 || (this.#nextVersion.major <= 15 && this.#nextVersion.minor < 1)) {
        childManagerScripts.push(new URL('./lib/create-context-patch.js', import.meta.url))
      }
      return this.startWithCommand(command, loaderUrl, childManagerScripts)
    }

    this.childManager = new ChildManager({
      loader: loaderUrl,
      context: {
        config: this.configManager.current,
        serviceId: this.serviceId,
        workerId: this.workerId,
        // Always use URL to avoid serialization problem in Windows
        root: pathToFileURL(this.root).toString(),
        basePath: this.#basePath,
        logLevel: this.logger.level,
        isEntrypoint: this.isEntrypoint,
        runtimeBasePath: this.runtimeConfig.basePath,
        wantsAbsoluteUrls: true,
        telemetryConfig: this.telemetryConfig
      },
      scripts: this.#getChildManagerScripts()
    })

    this.verifyOutputDirectory(pathResolve(this.root, '.next'))
    await this.#startProductionNext()
  }

  async #startProductionNext () {
    try {
      globalThis.platformatic.config = this.configManager.current
      await this.childManager.inject()
      const { nextStart } = await importFile(pathResolve(this.#next, './dist/cli/next-start.js'))

      const { hostname, port } = this.serverConfig ?? {}
      const serverOptions = {
        hostname: hostname || '127.0.0.1',
        port: port || 0
      }

      this.childManager.register()
      const serverPromise = createServerListener(
        (this.isEntrypoint ? serverOptions?.port : undefined) ?? true,
        (this.isEntrypoint ? serverOptions?.hostname : undefined) ?? true
      )

      if (this.#nextVersion.major === 14 && this.#nextVersion.minor < 2) {
        await nextStart({
          '--hostname': serverOptions.host,
          '--port': serverOptions.port,
          _: [this.root]
        })
      } else {
        await nextStart(serverOptions, this.root)
      }

      this.#server = await serverPromise
      this.url = getServerUrl(this.#server)
    } finally {
      await this.childManager.eject()
    }
  }

  #getChildManagerScripts () {
    const scripts = []

    if (this.#nextVersion.major === 15) {
      scripts.push(new URL('./lib/loader-next-15.cjs', import.meta.url))
    }

    return scripts
  }

  // In development mode, Next.js starts the dev server using child_process.fork with stdio set to 'inherit'.
  // In order to capture the output, we need to ensure that the streams are pipeable and thus we perform a one-time
  // monkey-patch of the ChildProcess.prototype.spawn method to override stdio[1] and stdio[2] to 'pipe'.
  #ensurePipeableStreamsInFork () {
    const originalSpawn = ChildProcess.prototype.spawn

    // IMPORTANT: If Next.js code changes this might not work anymore. When this gives error, dig into Next.js code
    // to evaluate the new path and/or if this is still necessary.
    const startServerPath = pathResolve(this.#next, './dist/server/lib/start-server.js')

    ChildProcess.prototype.spawn = function (options) {
      if (options.args?.[1] === startServerPath) {
        options.stdio[1] = 'pipe'
        options.stdio[2] = 'pipe'

        // Uninstall the patch
        ChildProcess.prototype.spawn = originalSpawn
      }

      return originalSpawn.call(this, options)
    }
  }
}

/* c8 ignore next 9 */
function transformConfig () {
  if (this.current.cache?.adapter === 'redis') {
    this.current.cache.adapter = 'valkey'
  }

  this.current.watch = { enabled: false }

  return basicTransformConfig.call(this)
}

export async function buildStackable (opts) {
  const root = opts.context.directory

  const configManager = new ConfigManager({
    schema,
    source: opts.config ?? {},
    schemaOptions,
    transformConfig,
    dirname: root,
    context: opts.context
  })
  await configManager.parseAndValidate()

  return new NextStackable(opts, root, configManager)
}

export default {
  configType: 'next',
  configManagerConfig: {
    schemaOptions,
    transformConfig
  },
  buildStackable,
  schema,
  version: packageJson.version
}

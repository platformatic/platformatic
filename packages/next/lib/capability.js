import {
  BaseCapability,
  errors as basicErrors,
  ChildManager,
  cleanBasePath,
  createChildProcessListener,
  createServerListener,
  getServerUrl,
  importFile,
  resolvePackageViaCJS
} from '@platformatic/basic'
import { ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { existsSync } from 'node:fs'
import { glob, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve as resolvePath, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, satisfies } from 'semver'
import * as errors from './errors.js'
import { version } from './schema.js'

const supportedVersions = ['^14.0.0', '^15.0.0', '^16.0.0']

export function getCacheHandlerPath (name) {
  return fileURLToPath(new URL(`./caching/${name}.js`, import.meta.url)).replaceAll(sep, '/')
}

export class NextCapability extends BaseCapability {
  #basePath
  #next
  #nextVersion
  #child
  #server
  #configModified
  #isStandalone

  constructor (root, config, context) {
    super('next', version, root, config, context)

    this.exitOnUnhandledErrors = false
  }

  async init () {
    await super.init()

    if (this.isProduction) {
      try {
        const buildInfo = JSON.parse(await readFile(resolvePath(this.root, '.platformatic-build.json'), 'utf-8'))

        if (buildInfo.standalone) {
          this.#isStandalone = true
          this.#nextVersion = parse(buildInfo.version)
          console.log('BUILD INFO:', this.#isStandalone)
        }
        return
      } catch (error) {

        // No-op
      }
    }

    // This is needed to avoid Next.js to throw an error when the lockfile is not correct
    // and the user is using npm but has pnpm in its $PATH.
    //
    // See: https://github.com/platformatic/composer-next-node-fastify/pull/3
    //
    // PS by Paolo: Sob.
    process.env.NEXT_IGNORE_INCORRECT_LOCKFILE = 'true'

    this.#next = resolvePath(dirname(await resolvePackageViaCJS(this.root, 'next')), '../..')
    const nextPackage = JSON.parse(await readFile(resolvePath(this.#next, 'package.json'), 'utf-8'))
    this.#nextVersion = parse(nextPackage.version)

    if (this.#nextVersion.major < 15 || (this.#nextVersion.major <= 15 && this.#nextVersion.minor < 1)) {
      await import('./create-context-patch.js')
    }

    if (this.#nextVersion.major < 16 && this.config.next?.useExperimentalAdapter === true) {
      this.config.next.useExperimentalAdapter = false
    }

    /* c8 ignore next 3 */
    if (!supportedVersions.some(v => satisfies(nextPackage.version, v))) {
      throw new basicErrors.UnsupportedVersion('next', nextPackage.version, supportedVersions)
    }
  }

  async start ({ listen }) {
    // Make this idempotent
    if (this.url) {
      return this.url
    }

    await super._start({ listen })

    this.on('config', config => {
      this.#configModified = true
      this.#basePath = config.basePath
    })

    if (this.isProduction) {
      await this.#startProduction(listen)
    } else {
      await this.#startDevelopment(listen)
    }

    await this._collectMetrics()

    if (!this.#configModified && this.config.next?.useExperimentalAdapter) {
      this.logger.warn(
        'The experimental Next.js adapterPath is enabled but the @platformatic/next adapter was not included.'
      )
      this.logger.warn(
        'Please ensure that your next.config.js is correctly set up to use the Platformatic Next.js adapter.'
      )
      this.logger.warn(
        'Refer to the documentation for more details: https://platformatic.dev/docs/reference/next/configuration#next.'
      )
    }
  }

  async stop () {
    await super.stop()

    if (this.subprocess) {
      return this.stopCommand()
    }

    globalThis.platformatic.events.emit('plt:next:close')

    if (this.isProduction && this.#server) {
      await this._closeServer(this.#server)
      await this.childManager.close()
    } else if (this.#child) {
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

    const config = this.config
    const loader = new URL('./loader.js', import.meta.url)
    this.#basePath = config.application?.basePath ? cleanBasePath(config.application?.basePath) : ''

    let command = config.application.commands.build

    if (!command) {
      await this.init()
      command = ['node', resolvePath(this.#next, './dist/bin/next'), 'build', this.root]
    }

    await this.buildWithCommand(command, this.#basePath, { loader, scripts: this.#getChildManagerScripts() })
    await this.#fixRequiredServerFiles()
  }

  /* c8 ignore next 5 */
  async getWatchConfig () {
    return {
      enabled: false,
      path: this.root
    }
  }

  getMeta () {
    const gateway = { prefix: this.basePath ?? this.#basePath, wantsAbsoluteUrls: true, needsRootTrailingSlash: false }

    if (this.url) {
      gateway.tcp = true
      gateway.url = this.url
    }

    return { gateway }
  }

  async getChildManagerContext (basePath) {
    const context = await super.getChildManagerContext(basePath)

    const { major, minor } = this.#nextVersion
    context.exitOnUnhandledErrors = false
    context.wantsAbsoluteUrls = true
    context.nextVersion = { major, minor }

    return context
  }

  async #startDevelopment () {
    const config = this.config
    const loaderUrl = new URL('./loader.js', import.meta.url)
    const command = this.config.application.commands.development

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

    this.childManager = this.#createChildManager(loaderUrl, { ...context, port: false }, this.#getChildManagerScripts())

    const promise = once(this.childManager, 'url')
    await this.#startDevelopmentNext(serverOptions)

    const [url, clientWs] = await promise
    this.url = url
    this.clientWs = clientWs
  }

  async #startDevelopmentNext (serverOptions) {
    const { nextDev } = await importFile(resolvePath(this.#next, './dist/cli/next-dev.js'))

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

  async #startProduction () {
    const config = this.config
    const loaderUrl = new URL('./loader.js', import.meta.url)
    const command = this.config.application.commands.production

    this.#basePath = config.application?.basePath ? cleanBasePath(config.application?.basePath) : ''

    if (command) {
      const childManagerScripts = this.#getChildManagerScripts()

      if (this.#nextVersion.major < 15 || (this.#nextVersion.major <= 15 && this.#nextVersion.minor < 1)) {
        childManagerScripts.push(new URL('./create-context-patch.js', import.meta.url))
      }
      return this.startWithCommand(command, loaderUrl, childManagerScripts)
    }

    this.childManager = this.#createChildManager(
      loaderUrl,
      await this.getChildManagerContext(this.#basePath),
      this.#getChildManagerScripts()
    )

    if (this.#isStandalone) {
      return this.#startProductionStandaloneNext()
    } else {
      this.verifyOutputDirectory(resolvePath(this.root, '.next'))
      return this.#startProductionNext()
    }
  }

  async #startProductionNext () {
    try {
      globalThis.platformatic.config = this.config
      await this.childManager.inject()
      const { nextStart } = await importFile(resolvePath(this.#next, './dist/cli/next-start.js'))

      const { hostname, port, backlog } = this.serverConfig ?? {}
      const serverOptions = {
        hostname: hostname || '127.0.0.1',
        port: port || 0
      }

      await this.childManager.register()

      const serverPromise = createServerListener(
        (this.isEntrypoint ? serverOptions?.port : undefined) ?? true,
        (this.isEntrypoint ? serverOptions?.hostname : undefined) ?? true,
        typeof backlog === 'number' ? { backlog } : {}
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

  async #startProductionStandaloneNext () {
    // If built in standalone mode, the generated standalone directory is not on the root of the project but somewhere
    // inside .next/standalone due to turbopack limitations in determining the root of the project.
    // In that case we search a server.js next to a .next folder inside the .next /standalone folder.
    const serverEntrypoints = await Array.fromAsync(
      glob(['**/server.js'], { cwd: this.root, ignore: ['node_modules', '**/node_modules/**'] })
    )

    let serverEntrypoint
    for (const entrypoint of serverEntrypoints) {
      if (existsSync(resolvePath(this.root, dirname(entrypoint), '.next'))) {
        serverEntrypoint = resolvePath(this.root, entrypoint)
        break
      }
    }

    if (!serverEntrypoint) {
      throw new errors.StandaloneServerNotFound()
    }

    // The default Next.js standalone server uses chdir, which is not supported in worker threads.
    // Therefore we need to reproduce the server.js logic here, which what we do in the rest of this method.

    // Parse the server.js to extract the nextConfig.
    // For now we use simple regex parsing, if it breaks, we can switch to proper AST parsing.
    let nextConfig
    try {
      const serverJsContent = await readFile(serverEntrypoint, 'utf-8')
      const nextConfigMatch = serverJsContent.match(/(?:const|let)\s*nextConfig\s*=\s*(\{.+)/)
      nextConfig = JSON.parse(nextConfigMatch[1])
    } catch (e) {
      throw new errors.CannotParseStandaloneServer({ cause: e })
    }

    // Fix cache handlers path
    if (nextConfig.env?.PLT_NEXT_MODIFICATIONS) {
      const pltNextModifications = JSON.parse(nextConfig.env.PLT_NEXT_MODIFICATIONS)

      if (pltNextModifications.isrCache) {
        nextConfig.cacheHandler = getCacheHandlerPath(`${pltNextModifications.isrCache}-isr`)
      } else if (pltNextModifications.componentsCache) {
        nextConfig.cacheHandler = getCacheHandlerPath('null-isr')
        nextConfig.cacheHandlers.default = getCacheHandlerPath(`${pltNextModifications.componentsCache}-components`)
      }
    }

    try {
      await this.childManager.inject()
      await this.childManager.register()

      const { hostname, port, backlog } = this.serverConfig ?? {}
      const serverOptions = {
        hostname: hostname || '127.0.0.1',
        port: port || 0
      }

      const serverPromise = createServerListener(
        (this.isEntrypoint ? serverOptions?.port : undefined) ?? true,
        (this.isEntrypoint ? serverOptions?.hostname : undefined) ?? true,
        typeof backlog === 'number' ? { backlog } : {}
      )

      let keepAliveTimeout = parseInt(process.env.KEEP_ALIVE_TIMEOUT, 10)
      if (Number.isNaN(keepAliveTimeout) || !Number.isFinite(keepAliveTimeout) || keepAliveTimeout < 0) {
        keepAliveTimeout = undefined
      }

      // This is needed by Next.js standalone server to pick up the correct configuration
      process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig)
      const require = createRequire(serverEntrypoint)
      const serverModule = require('next/dist/server/lib/start-server.js')
      const { startServer } = serverModule.default ?? serverModule

      await startServer({
        dir: dirname(serverEntrypoint),
        isDev: false,
        config: nextConfig,
        hostname: serverOptions.hostname,
        port: serverOptions.port,
        allowRetry: false,
        keepAliveTimeout
      })

      this.#server = await serverPromise
      this.url = getServerUrl(this.#server)
    } finally {
      await this.childManager.eject()
    }
  }

  #getChildManagerScripts () {
    const scripts = []

    if (this.#nextVersion.major >= 15) {
      scripts.push(new URL('./loader-next-15.cjs', import.meta.url))
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
    const startServerPath = resolvePath(this.#next, './dist/server/lib/start-server.js')

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

  #createChildManager (loader, context, scripts) {
    const childManager = new ChildManager({
      loader,
      context,
      scripts
    })

    this.setupChildManagerEventsForwarding(childManager)
    return childManager
  }

  async #fixRequiredServerFiles () {
    const config = this.config
    const distDir = resolvePath(this.root, '.next')

    // This is need to avoid Next.js 15.4+ to throw an error as process.cwd() is not the root of the Next.js application
    if (
      config.cache?.adapter &&
      (this.#nextVersion.major > 15 || (this.#nextVersion.major === 15 && this.#nextVersion.minor >= 4))
    ) {
      const requiredServerFilesPath = resolvePath(distDir, 'required-server-files.json')
      const requiredServerFiles = JSON.parse(await readFile(requiredServerFilesPath, 'utf-8'))

      if (requiredServerFiles.config.cacheHandler) {
        requiredServerFiles.config.cacheHandler = resolvePath(distDir, requiredServerFiles.config.cacheHandler)
        await writeFile(requiredServerFilesPath, JSON.stringify(requiredServerFiles, null, 2))
      }
    }

    // This is needed to allow to have a standalone server working correctly
    if (existsSync(resolvePath(distDir, 'standalone'))) {
      await writeFile(
        resolvePath(distDir, 'standalone/.platformatic-build.json'),
        JSON.stringify({ standalone: true, version: this.#nextVersion.version }),
        'utf-8'
      )
    }

    return distDir
  }
}

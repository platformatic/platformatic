import fastifyStatic from '@fastify/static'
import {
  cleanBasePath,
  createServerListener,
  ensureTrailingSlash,
  errors,
  getServerUrl,
  importFile,
  resolvePackageViaCJS
} from '@platformatic/basic'
import { ViteCapability } from '@platformatic/vite'
import { createRequestHandler } from '@remix-run/node'
import fastify from 'fastify'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { satisfies } from 'semver'
import { packageJson } from './schema.js'

const supportedVersions = '^2.0.0'

export class RemixCapability extends ViteCapability {
  #app
  #remix
  #basePath

  constructor (root, config, context) {
    super(root, config, context)
    this.type = 'remix'
    this.version = packageJson.version
  }

  async init () {
    await super.init()

    if (!this.isProduction) {
      this.#remix = resolve(dirname(await resolvePackageViaCJS(this.root, '@remix-run/dev')), '..')
      const remixPackage = JSON.parse(await readFile(resolve(this.#remix, 'package.json'), 'utf-8'))

      if (!satisfies(remixPackage.version, supportedVersions)) {
        throw new errors.UnsupportedVersion('@remix-run/dev', remixPackage.version, supportedVersions)
      }
    }

    const config = this.config
    this.#basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
      : undefined

    this.registerGlobals({ basePath: this.#basePath })

    this.subprocessTerminationSignal = 'SIGKILL'
  }

  async start ({ listen }) {
    // Make this idempotent
    if (this.url) {
      return this.url
    }

    await this._start({ listen })

    const config = this.config
    const command = config.application.commands[this.isProduction ? 'production' : 'development']

    if (command) {
      return this.startWithCommand(command)
    }

    return this.isProduction ? this.#startProduction(listen) : this.#startDevelopment(listen)
  }

  async build () {
    const config = this.config
    const command = config.application.commands.build
    const basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
      : undefined

    if (command) {
      return this.buildWithCommand(command, basePath)
    }

    await this.init()
    const { viteBuild } = await importFile(resolve(this.#remix, 'dist/cli/commands.js'))

    try {
      globalThis.platformatic.isBuilding = true

      await viteBuild(this.root, {
        emptyOutDir: true,
        logLevel: this.logger.level,
        mode: 'production',
        profile: false
      })
    } finally {
      globalThis.platformatic.isBuilding = false
    }
  }

  getMeta () {
    if (!this.isProduction) {
      return super.getMeta()
    }

    return {
      gateway: {
        tcp: typeof this.url !== 'undefined',
        url: this.url,
        prefix: this.basePath ?? this.#basePath,
        wantsAbsoluteUrls: true,
        needsRootTrailingSlash: true
      }
    }
  }

  async #startDevelopment (listen) {
    const preloadViteEsmPath = resolve(this.#remix, './dist/vite/import-vite-esm-sync.js')

    // Older versions
    if (existsSync(preloadViteEsmPath)) {
      const { preloadViteEsm } = await importFile(resolve(this.#remix, './dist/vite/import-vite-esm-sync.js'))
      await preloadViteEsm()
    } else {
      const { preloadVite } = await importFile(resolve(this.#remix, './dist/vite/vite.js'))
      await preloadVite()
    }

    await super.start({ listen })

    /* c8 ignore next 3 */
    if (!this._getApp().config.plugins.some(p => p.name === 'remix')) {
      this.logger.warn('Could not find Remix plugin in your Vite configuration. Continuing as plain Vite application.')
    }
  }

  async #startProduction (listen) {
    // Listen if entrypoint
    if (this.#app && listen) {
      const serverOptions = this.serverConfig
      const listenOptions = { host: serverOptions?.hostname || '127.0.0.1', port: serverOptions?.port || 0 }

      if (typeof serverOptions?.backlog === 'number') {
        createServerListener(false, false, { backlog: serverOptions.backlog })
      }

      await this.#app.listen(listenOptions)
      this.url = getServerUrl(this.#app.server)
      return this.url
    }

    const outputDirectory = this.config.remix.outputDirectory
    this.verifyOutputDirectory(resolve(this.root, outputDirectory))

    const build = await importFile(resolve(this.root, `${outputDirectory}/server/index.js`))
    this.#basePath = ensureTrailingSlash(cleanBasePath(build.basename))

    // Setup fastify
    this.#app = fastify({ loggerInstance: this.logger })
    this._setApp(this.#app)

    // Since it uses the Fetch API, we don't need to parse the request body.
    this.#app.removeAllContentTypeParsers()
    this.#app.addContentTypeParser('*', function (_, payload, done) {
      done(null, payload)
    })

    await this.#app.register(fastifyStatic, {
      root: resolve(this.root, `${outputDirectory}/client/assets`),
      prefix: join(this.#basePath, 'assets'),
      prefixAvoidTrailingSlash: true,
      schemaHide: true
    })

    this.#app.all(
      `${ensureTrailingSlash(cleanBasePath(this.#basePath))}*`,
      this.#handleRequest.bind(this, createRequestHandler(build, process.env.NODE_ENV))
    )

    await this.#app.ready()
    await this._collectMetrics()
  }

  #handleRequest (handle, req) {
    // Support aborting
    const ac = new AbortController()
    let ended = false

    req.raw.on('aborted', () => ac.abort())
    req.raw.on('end', () => { ended = true })
    req.raw.on('close', () => {
      if (!ended) {
        ac.abort()
      }
    })

    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(',') : value)
      }
    }

    let body

    if (!['GET', 'HEAD'].includes(req.method)) {
      body = Readable.toWeb(req.raw)
    }

    return handle(
      new Request(`${req.protocol}://${req.hostname}${req.raw.url}`, {
        method: req.method,
        headers,
        body,
        duplex: body ? 'half' : undefined,
        signal: ac.signal
      })
    )
  }
}

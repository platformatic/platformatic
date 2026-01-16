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
import fastify from 'fastify'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { createRequestHandler } from 'react-router'
import { satisfies } from 'semver'
import { packageJson } from './schema.js'

const supportedVersions = '^7.0.0'

export class ReactRouterCapability extends ViteCapability {
  #app
  #reactRouter
  #basePath

  constructor (root, config, context) {
    super(root, config, context)
    this.type = 'react-router'
    this.version = packageJson.version
  }

  async init () {
    await super.init()

    if (!this.isProduction) {
      this.#reactRouter = resolve(dirname(await resolvePackageViaCJS(this.root, 'react-router')), '../..')
      const reactRouterPackage = JSON.parse(await readFile(resolve(this.#reactRouter, 'package.json'), 'utf-8'))

      if (!satisfies(reactRouterPackage.version, supportedVersions)) {
        throw new errors.UnsupportedVersion('react-router', reactRouterPackage.version, supportedVersions)
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

    const config = this.config
    const reactRouterConfig = await this.#getReactRouterConfig()

    if (this.isProduction) {
      const command = this.config.application.commands.production

      this.outputDirectory = resolve(this.root, config.reactRouter.outputDirectory, 'client')
      this.buildInfoPath = resolve(this.root, config.reactRouter.outputDirectory, '.platformatic-build.json')

      if (command) {
        return this.startWithCommand(command)
      }

      if (reactRouterConfig.ssr) {
        await super._start({ listen })

        return this.#startSSRProduction(listen)
      }
    }

    return super.start({ listen })
  }

  async build () {
    const config = this.config
    const command = config.application.commands.build
    const basePath = config.application?.basePath
      ? ensureTrailingSlash(cleanBasePath(config.application?.basePath))
      : undefined

    const reactRouterConfig = await this.#getReactRouterConfig()

    if (command) {
      return this.buildWithCommand(command, basePath)
    }

    await this.buildWithCommand(`react-router build -m production ${this.root}`, basePath)

    await writeFile(
      resolve(this.root, config.reactRouter.outputDirectory, '.platformatic-build.json'),
      JSON.stringify({ basePath: basePath ?? reactRouterConfig.basename ?? '/' }),
      'utf-8'
    )
  }

  async getMeta () {
    const reactRouterConfig = await this.#getReactRouterConfig()
    return super.getMeta(reactRouterConfig.basename)
  }

  async #getReactRouterConfig () {
    const ext = ['ts', 'js'].find(ext => existsSync(resolve(this.root, `react-router.config.${ext}`)))

    if (!ext) {
      return {}
    }

    const { default: reactRouterConfig } = await importFile(resolve(this.root, `react-router.config.${ext}`))
    return reactRouterConfig ?? {}
  }

  async #startSSRProduction (listen) {
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

    const config = this.config

    const clientRoot = resolve(this.root, config.reactRouter.outputDirectory, 'client')
    const serverRoot = resolve(this.root, config.reactRouter.outputDirectory, 'server')
    this.verifyOutputDirectory(clientRoot)
    this.verifyOutputDirectory(serverRoot)
    this.#basePath = await this._getBasePathFromBuildInfo()

    const serverModule = await importFile(resolve(serverRoot, 'index.js'))

    // Setup fastify
    this.#app = fastify({ loggerInstance: this.logger })
    this._setApp(this.#app)

    let assetsRoot = clientRoot
    let publicPath = '/'
    let mainHandler

    // Custom entrypoint
    if (serverModule.entrypoint) {
      mainHandler = createRequestHandler(() => serverModule.entrypoint, process.env.NODE_ENV)
      // Adapts @react-router/serve to fastify
    } else {
      if (serverModule.assetsBuildDirectory) {
        assetsRoot = resolve(this.root, serverModule.assetsBuildDirectory)
      }

      if (serverModule.publicPath) {
        publicPath = serverModule.publicPath ?? '/'
      }

      // RSC build
      if (typeof serverModule.default === 'function') {
        if (serverModule.unstable_reactRouterServeConfig) {
          if (serverModule.unstable_reactRouterServeConfig.assetsBuildDirectory) {
            assetsRoot = resolve(this.root, serverModule.unstable_reactRouterServeConfig.assetsBuildDirectory)
          }
          if (serverModule.unstable_reactRouterServeConfig.publicPath) {
            publicPath = serverModule.unstable_reactRouterServeConfig.publicPath
          }
        }

        mainHandler = serverModule.default
      } else {
        mainHandler = createRequestHandler(serverModule, process.env.NODE_ENV)
      }
    }

    await this.#app.register(fastifyStatic, {
      root: resolve(assetsRoot, 'assets'),
      prefix: join(this.#basePath, 'assets'),
      prefixAvoidTrailingSlash: true,
      schemaHide: true,
      decorateReply: false
    })

    if (publicPath !== '/') {
      await this.#app.register(fastifyStatic, {
        root: resolve(assetsRoot, 'assets'),
        prefix: join(this.#basePath, publicPath),
        prefixAvoidTrailingSlash: true,
        schemaHide: true,
        decorateReply: false
      })
    }

    this.#app.all(`${ensureTrailingSlash(cleanBasePath(this.#basePath))}*`, this.#handleRequest.bind(this, mainHandler))

    await this.#app.ready()
    await this._collectMetrics()
  }

  #handleRequest (handle, req) {
    // Support aborting
    const ac = new AbortController()

    req.raw.on('aborted', () => ac.abort())
    req.raw.on('close', () => ac.abort())

    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(',') : value)
      }
    }

    return handle(
      new Request(`${req.protocol}://${req.hostname}${req.raw.url}`, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : ReadableStream.from(req.raw),
        duplex: 'half',
        signal: ac.signal
      })
    )
  }
}

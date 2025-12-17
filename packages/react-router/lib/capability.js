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
import { createRequestHandler } from '@react-router/express'
import express from 'express'
import inject from 'light-my-request'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pinoHttp } from 'pino-http'
import { satisfies } from 'semver'
import { packageJson } from './schema.js'

const supportedVersions = '^7.0.0'

export class ReactRouterCapability extends ViteCapability {
  #app
  #server
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
        return this.#startSSRProduction(listen)
      }
    }

    return super.start({ listen })
  }

  async stop () {
    const reactRouterConfig = await this.#getReactRouterConfig()

    if (reactRouterConfig.ssr) {
      await this._stop()

      if (this.#server?.listening) {
        await this._closeServer(this.#server)
      }

      return
    }

    return super.stop()
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
      JSON.stringify({ basePath: reactRouterConfig.basename ?? '/' }),
      'utf-8'
    )
  }

  async getMeta () {
    const reactRouterConfig = await this.#getReactRouterConfig()
    return super.getMeta(reactRouterConfig.basename)
  }

  async inject (injectParams, onInject) {
    const reactRouterConfig = await this.#getReactRouterConfig()

    if (this.isProduction && reactRouterConfig.ssr) {
      return this.#inject(injectParams, onInject)
    }

    return super.inject(injectParams, onInject)
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

      this.#server = await new Promise((resolve, reject) => {
        return this.#app
          .listen(listenOptions, function () {
            resolve(this)
          })
          .on('error', reject)
      })

      this.url = getServerUrl(this.#server)

      return this.url
    }

    const config = this.config

    const clientRoot = resolve(this.root, config.reactRouter.outputDirectory, 'client')
    const serverRoot = resolve(this.root, config.reactRouter.outputDirectory, 'server')
    this.verifyOutputDirectory(clientRoot)
    this.verifyOutputDirectory(serverRoot)
    this.#basePath = await this._getBasePathFromBuildInfo()

    const { entrypoint } = await importFile(resolve(serverRoot, 'index.js'))

    // Setup express app
    this.#app = express()
    this._setApp(this.#app)
    this.#app.disable('x-powered-by')
    this.#app.use(pinoHttp({ logger: this.logger }))
    this.#app.use(this.#basePath, express.static(clientRoot))
    this.#app.all(
      `${ensureTrailingSlash(cleanBasePath(this.#basePath))}*`,
      createRequestHandler({ build: () => entrypoint })
    )

    await this._collectMetrics()
    return this.url
  }

  async #inject (injectParams, onInject) {
    const res = await inject(this.#app, injectParams, onInject)

    /* c8 ignore next 3 */
    if (onInject) {
      return
    }

    // Since inject might be called from the main thread directly via ITC, let's clean it up
    const { statusCode, headers, body, payload, rawPayload } = res
    return { statusCode, headers, body, payload, rawPayload }
  }
}

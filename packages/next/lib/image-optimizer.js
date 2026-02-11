import {
  BaseCapability,
  errors as basicErrors,
  createServerListener,
  getServerUrl,
  importFile,
  resolvePackageViaCJS
} from '@platformatic/basic'
import { cleanBasePath } from '@platformatic/basic/lib/utils.js'
import { ensureLoggableError } from '@platformatic/foundation/lib/errors.js'
import fastify from 'fastify'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve as resolvePath } from 'node:path'
import { parse, satisfies } from 'semver'
import { supportedVersions } from './capability.js'
import { version } from './schema.js'

export class NextImageOptimizerCapability extends BaseCapability {
  #basePath
  #fallbackDomain
  #next
  #nextVersion
  #configModified
  #app

  constructor (root, config, context) {
    super('next-image', version, root, config, context)

    this.exitOnUnhandledErrors = false

    this.#fallbackDomain = this.config.next?.imageOptimizer?.fallback

    // If it's not a full URL, it's a local service
    if (!this.#fallbackDomain.startsWith('http://') && !this.#fallbackDomain.startsWith('https://')) {
      this.#fallbackDomain = `http://${this.#fallbackDomain}.plt.local`
    }

    if (this.#fallbackDomain.endsWith('/')) {
      this.#fallbackDomain = this.#fallbackDomain.slice(0, -1)
    }
  }

  async init (building = false) {
    await super.init()

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

    /* c8 ignore next 3 */
    if (!this.isProduction && !supportedVersions.some(v => satisfies(nextPackage.version, v))) {
      throw new basicErrors.UnsupportedVersion('next', nextPackage.version, supportedVersions)
    }
  }

  async start ({ listen }) {
    // Make this idempotent
    if (this.url) {
      return this.url
    }

    const config = this.config
    this.#basePath = config.application?.basePath ? cleanBasePath(config.application?.basePath) : ''
    await super._start({ listen })

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

    const { imageOptimizer, ImageOptimizerCache } = await importFile(
      resolvePath(this.#next, './dist/server/image-optimizer.js')
    )

    let nextConfig
    try {
      const { default: loadConfigAPI } = await importFile(resolvePath(this.#next, './dist/server/config.js'))
      nextConfig = await loadConfigAPI.default('production', this.root)
    } catch (error) {
      this.logger.error({ err: ensureLoggableError(error) }, 'Error loading Next.js configuration.')
      throw new Error('Failed to load Next.js configuration.', { cause: error })
    }

    this.#app = fastify({ loggerInstance: this.logger })
    this.#app.get(
      `${this.#basePath}/_next/image`,
      this.#handleImageRequest.bind(this, nextConfig, imageOptimizer, ImageOptimizerCache)
    )
    await this.#app.ready()
  }

  async stop () {
    await super.stop()

    globalThis.platformatic.events.emit('plt:next:close')
    return this.#app?.close()
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

  async #handleImageRequest (nextConfig, imageOptimizer, ImageOptimizerCache, request, reply) {
    try {
      const params = ImageOptimizerCache.validateParams(request.raw, request.query, nextConfig, false)

      if (params.errorMessage) {
        const error = new Error('Invalid optimization parameters.')
        error.reason = params.errorMessage
        throw error
      }

      let url
      if (params.isAbsolute) {
        url = params.href
      } else {
        url = `${this.#fallbackDomain}${params.href.startsWith('/') ? '' : '/'}${params.href}`
      }

      const imageResult = await this.#fetchFallbackImage(url)

      // Fetch the image
      const opts = this.#nextVersion.major === 14 ? false : { isDev: false }
      const result = await imageOptimizer(imageResult, params, nextConfig, opts)

      reply.type(result.contentType).header('Cache-Control', result.maxAge).send(result.buffer)
    } catch (error) {
      // Something bad happened and it's not a client error, log the error as well
      if (error.statusCode / 100 !== 4) {
        this.logger.error({ err: ensureLoggableError(error) }, 'Error optimizing image.')
      }

      reply.status(502).send({
        error: 'Bad Gateway',
        message: 'An error occurred while optimizing the image.',
        statusCode: 502,
        cause: { ...ensureLoggableError(error), stack: undefined }
      })
    }
  }

  async #fetchFallbackImage (url) {
    let response
    try {
      response = await fetch(url)
    } catch (error) {
      this.logger.error({ err: ensureLoggableError(error) }, 'Error fetching fallback image.')
      throw new Error('"url" parameter is valid but upstream response is invalid')
    }

    if (!response.ok) {
      const error = new Error(`"url" parameter is valid but upstream response is invalid (HTTP ${response.status})`)
      error.statusCode = response.status
      throw error
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type')
    const cacheControl = response.headers.get('cache-control')

    const etag = response.headers.get('etag') ?? createHash('sha256').update(buffer).digest('base64url')

    return { buffer, contentType, cacheControl, etag }
  }
}

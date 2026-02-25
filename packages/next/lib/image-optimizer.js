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
import { createQueue } from '@platformatic/image-optimizer'
import { FileStorage, MemoryStorage, RedisStorage } from '@platformatic/job-queue'
import inject from 'light-my-request'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, resolve as resolvePath } from 'node:path'
import { satisfies } from 'semver'
import { supportedVersions } from './capability.js'
import { version } from './schema.js'

export class NextImageOptimizerCapability extends BaseCapability {
  #basePath
  #fallbackDomain
  #next
  #nextConfig
  #validateParams
  #app
  #server
  #dispatcher
  #queue
  #fetchTimeout

  constructor (root, config, context) {
    super('next-image', version, root, config, context)
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

    this.#next = resolvePath(dirname(await resolvePackageViaCJS(this.root, 'next')), '../..')
    const nextPackage = JSON.parse(await readFile(resolvePath(this.#next, 'package.json'), 'utf-8'))

    /* c8 ignore next 3 */
    if (!this.isProduction && !supportedVersions.some(v => satisfies(nextPackage.version, v))) {
      throw new basicErrors.UnsupportedVersion('next', nextPackage.version, supportedVersions)
    }

    const imageOptimizerConfig = this.config.next?.imageOptimizer ?? {}

    this.#fetchTimeout = imageOptimizerConfig?.timeout ?? 30000
    this.#fallbackDomain = this.config.next?.imageOptimizer?.fallback

    // If it's not a full URL, it's a local service
    if (!this.#fallbackDomain.startsWith('http://') && !this.#fallbackDomain.startsWith('https://')) {
      this.#fallbackDomain = `http://${this.#fallbackDomain}.plt.local`
    }

    if (this.#fallbackDomain.endsWith('/')) {
      this.#fallbackDomain = this.#fallbackDomain.slice(0, -1)
    }

    this.#queue = await this.#createQueue(imageOptimizerConfig)
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
        listenOptions.backlog = serverOptions.backlog
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

    const { ImageOptimizerCache } = await importFile(resolvePath(this.#next, './dist/server/image-optimizer.js'))
    this.#validateParams = ImageOptimizerCache.validateParams.bind(ImageOptimizerCache)

    try {
      const { default: loadConfigAPI } = await importFile(resolvePath(this.#next, './dist/server/config.js'))
      this.#nextConfig = await loadConfigAPI.default('production', this.root)
    } catch (error) {
      this.logger.error({ err: ensureLoggableError(error) }, 'Error loading Next.js configuration.')
      throw new Error('Failed to load Next.js configuration.', { cause: error })
    }

    this.#app = createServer(this.#handleRequest.bind(this))
    this.#dispatcher = this.#app.listeners('request')[0]
    await this.#queue.start()
  }

  async stop () {
    await super.stop()
    await this.#queue?.stop()

    globalThis.platformatic.events.emit('plt:next:close')

    if (!this.#app || !this.#server?.listening) {
      return
    }
    const { promise, resolve, reject } = Promise.withResolvers()

    this.#server.close(error => {
      if (error) {
        return reject(error)
      }

      resolve()
    })

    return promise
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

  async inject (injectParams, onInject) {
    this.logger.trace({ injectParams }, 'injecting via light-my-request')
    const res = inject(this.#dispatcher ?? this.#app, injectParams, onInject)

    /* c8 ignore next 3 */
    if (onInject) {
      return
    }

    // Since inject might be called from the main thread directly via ITC, let's clean it up
    const { statusCode, headers, body, payload, rawPayload } = res

    return { statusCode, headers, body, payload, rawPayload }
  }

  async #createQueue (imageOptimizerConfig) {
    const queueOptions = {
      visibilityTimeout: imageOptimizerConfig.timeout,
      maxRetries: imageOptimizerConfig.maxAttempts,
      logger: this.logger
    }

    if (imageOptimizerConfig.storage.type === 'memory') {
      queueOptions.storage = new MemoryStorage()
    } else if (imageOptimizerConfig.storage.type === 'filesystem') {
      queueOptions.storage = new FileStorage({
        basePath: imageOptimizerConfig.storage.path ?? resolvePath(this.root, '.next/cache/image-optimizer')
      })
    } else {
      const redisStorageOptions = {
        url: this.#buildRedisStorageUrl(imageOptimizerConfig.storage.url, imageOptimizerConfig.storage.db)
      }

      if (typeof imageOptimizerConfig.storage.prefix === 'string') {
        redisStorageOptions.keyPrefix = imageOptimizerConfig.storage.prefix
      }

      queueOptions.storage = new RedisStorage(redisStorageOptions)
    }

    return createQueue(queueOptions)
  }

  #buildRedisStorageUrl (url, db) {
    if (typeof db === 'undefined') {
      return url
    }

    const parsedUrl = new URL(url)
    parsedUrl.pathname = `/${db}`
    return parsedUrl.toString()
  }

  async #handleRequest (request, response) {
    const { pathname, searchParams } = new URL(request.url, 'http://localhost')
    const imagePath = `${this.#basePath}/_next/image`

    if (request.method !== 'GET' || pathname !== imagePath) {
      response.statusCode = 404
      response.end('Not Found')
      return
    }

    const query = {}

    for (const [key, value] of searchParams.entries()) {
      if (typeof query[key] === 'undefined') {
        query[key] = value
      } else if (Array.isArray(query[key])) {
        query[key].push(value)
      } else {
        query[key] = [query[key], value]
      }
    }

    try {
      // Extract and validate the parameters
      const params = this.#validateParams(request, query, this.#nextConfig, false)

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

      const result = await this.#queue.fetchAndOptimize(
        url,
        params.width,
        params.quality,
        this.#nextConfig.images.dangerouslyAllowSVG,
        { timeout: this.#fetchTimeout }
      )
      const buffer = Buffer.from(result.buffer, 'base64')

      response.statusCode = 200
      response.setHeader('Content-Type', result.contentType)
      response.setHeader('Cache-Control', result.cacheControl)
      response.end(buffer)
    } catch (error) {
      response.statusCode = 502
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.end(
        JSON.stringify({
          error: 'Bad Gateway',
          message: 'An error occurred while optimizing the image.',
          statusCode: 502,
          cause: {
            ...ensureLoggableError(error.originalError ? JSON.parse(error.originalError) : error),
            stack: undefined
          }
        })
      )
    }
  }
}

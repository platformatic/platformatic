import { readFile } from 'node:fs/promises'
import { join, resolve, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { loadConfiguration } from '@platformatic/runtime'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Simple replacement for ensureLoggableError
function ensureLoggableError (err) {
  if (!err) return err
  if (typeof err === 'string') return new Error(err)
  if (err instanceof Error) return err
  return new Error(String(err))
}

async function restartRuntime (runtime) {
  runtime.logger.info('Received SIGUSR2, restarting all services ...')

  try {
    await runtime.restart()
  } catch (err) {
    runtime.logger.error({ err: ensureLoggableError(err) }, 'Failed to restart services.')
  }
}

class WattPro {
  #env
  #logger
  #require
  #appDir
  #applicationName
  #instanceId
  #instanceConfig
  #originalConfig
  #config
  #sharedContext

  constructor (app) {
    this.#env = app.env
    this.#logger = app.log
    this.#appDir = app.env.PLT_APP_DIR
    this.#applicationName = app.applicationName || app.env.PLT_APP_NAME
    this.#require = createRequire(join(this.#appDir, 'package.json'))
    this.#instanceId = app.instanceId
    this.runtime = null
    this.#sharedContext = {}
    this.#instanceConfig = app.instanceConfig
  }

  async spawn () {
    try {
      this.runtime = await this.#createRuntime()
      this.#logger.info('Starting runtime')
      await this.runtime.start()
      await this.updateSharedContext(this.#sharedContext)
      this.#logger.info('Runtime started')
    } catch (err) {
      this.#logger.error({ err: ensureLoggableError(err) }, 'Failed to start runtime')
      throw err
    }
  }

  async close () {
    if (this.runtime) {
      const runtime = this.runtime
      this.runtime = null

      this.#logger.info('Closing runtime')
      await runtime.close()
      this.#logger.info('Runtime closed')
    }
  }

  async applyIccConfigUpdates (config) {
    this.#logger.info({ config }, 'Applying ICC config updates')

    if (this.#instanceConfig) {
      this.#instanceConfig.config = config
    }

    if (config.httpCacheConfig) {
      try {
        const undiciConfig = await this.#getUndiciConfig()
        await this.runtime.updateUndiciInterceptors?.(undiciConfig)
      } catch (err) {
        this.#logger.error({ err }, 'Failed to update undici interceptors')
      }
    }

    if (config.resources?.services && config.resources.services.length > 0) {
      const resourceUpdates = config.resources.services.map(service => ({
        service: service.name,
        workers: service.threads,
        health: {
          maxHeapTotal: `${service.heap}MB`
        }
      }))

      try {
        await this.runtime.updateServicesResources(resourceUpdates)
        this.#logger.info({ resourceUpdates }, 'Successfully updated service resources')
      } catch (err) {
        this.#logger.error({ err, resourceUpdates }, 'Failed to update service resources')
      }
    }
  }

  async updateSharedContext (context) {
    this.#sharedContext = context
    await this.runtime?.updateSharedContext?.({ context })
  }

  async #loadAppConfig () {
    this.#logger.info('Loading app config')
    try {
      const config = await loadConfiguration(this.#appDir)
      return config
    } catch (err) {
      this.#logger.error(err, 'Failed to load app config')
      throw new Error('Failed to load app config.', { cause: err })
    }
  }

  async #createRuntime () {
    this.#logger.info('Creating runtime')
    const { Runtime } = this.#require('@platformatic/runtime')

    this.#config = await this.#loadAppConfig()

    this.#logger.info('Patching runtime config')

    this.#originalConfig = structuredClone(this.#config)

    if (this.#config) {
      this.#patchRuntimeConfig(this.#config)
    }

    this.#logger.info('Building runtime')

    const runtime = new Runtime(this.#config)

    /* c8 ignore next 3 */
    const restartListener = restartRuntime.bind(null, runtime)
    process.on('SIGUSR2', restartListener)
    runtime.on('closed', () => {
      process.removeListener('SIGUSR2', restartListener)
    })

    await this.#configureServices(runtime)

    try {
      await runtime.init()
    } catch (e) {
      await runtime.close()
      throw e
    }

    return runtime
  }

  #patchRuntimeConfig (config) {
    this.#configureRuntime(config)
    this.#configureTelemetry(config)
    this.#configureHttpCaching(config)
    this.#configureHealth(config)
    this.#configureSystemResources(config)
    this.#configureScheduler(config)
  }

  #configureRuntime (config) {
    const { https, ...serverConfig } = config.server ?? {}
    config.server = {
      ...serverConfig,
      hostname: this.#env.PLT_APP_HOSTNAME || serverConfig.hostname,
      port: this.#env.PLT_APP_PORT || serverConfig.port
    }

    config.hotReload = false
    config.restartOnError = 1000
    config.metrics = {
      hostname: this.#env.PLT_APP_HOSTNAME,
      port: this.#env.PLT_METRICS_PORT,
      labels: {
        applicationId: this.#instanceConfig.applicationId,
        instanceId: this.#instanceId
      }
    }

    if (this.#env.PLT_DISABLE_FLAMEGRAPHS !== true) {
      if (config.preload === undefined) {
        config.preload = []
      }
      config.preload.push(join(__dirname, './flamegraphs.js'))
    }

    this.#configureUndici(config)
    config.managementApi = true
  }

  #getUndiciConfig () {
    const config = this.#config

    const undiciConfig = structuredClone(
      this.#originalConfig.undici ?? {}
    )

    if (undiciConfig.interceptors === undefined) {
      undiciConfig.interceptors = []
    }

    const enableSlicerInterceptor = this.#instanceConfig?.enableSlicerInterceptor ?? false
    if (enableSlicerInterceptor) {
      const slicerInterceptorConfig = this.#getSlicerInterceptorConfig(config)
      if (slicerInterceptorConfig) {
        undiciConfig.interceptors.push(slicerInterceptorConfig)
      }
    }

    const enableTrafficanteInterceptor = this.#instanceConfig?.enableTrafficanteInterceptor ?? false
    if (enableTrafficanteInterceptor) {
      const trafficanteInterceptorConfig = this.#getTrafficanteInterceptorConfig()
      if (trafficanteInterceptorConfig) {
        undiciConfig.interceptors.push(trafficanteInterceptorConfig)
      }
    }

    return undiciConfig
  }

  #configureUndici (config) {
    config.undici = this.#getUndiciConfig(config)
  }

  #getTrafficanteInterceptorConfig () {
    if (!this.#instanceConfig?.iccServices?.trafficante?.url) {
      return
    }
    const {
      origin: trafficanteOrigin,
      pathname: trafficantePath
    } = new URL(this.#instanceConfig.iccServices.trafficante.url)
    return {
      module: this.#require.resolve('@platformatic/undici-trafficante-interceptor'),
      options: {
        labels: {
          applicationId: this.#instanceConfig.applicationId
        },
        bloomFilter: {
          size: 100000,
          errorRate: 0.01
        },
        maxResponseSize: 5 * 1024 * 1024, // 5MB
        trafficante: {
          url: trafficanteOrigin,
          pathSendBody: join(trafficantePath, '/requests'),
          pathSendMeta: join(trafficantePath, '/requests/hash')
        },
        matchingDomains: [this.#env.PLT_APP_INTERNAL_SUB_DOMAIN]
      }
    }
  }

  #getSlicerInterceptorConfig (config) {
    // We need to initialize the slicer interceptor even if there is no cache config
    // to be able to update the onfiguration at runtime
    const defaultCacheConfig = {
      rules: [{
        routeToMatch: 'http://plt.slicer.default/',
        headers: {}
      }]
    }

    // This is the cache config from ICC
    const httpCacheConfig = this.#instanceConfig?.config?.httpCacheConfig ?? defaultCacheConfig
    let autoGeneratedConfig = null
    if (httpCacheConfig) {
      try {
        autoGeneratedConfig = httpCacheConfig
      } catch (e) {
        this.#logger.error(
          { err: ensureLoggableError(e) },
          'Failed to parse auto generated cache config'
        )
      }
    }

    let userConfig = null
    // This is the user config from the environment variable
    if (this.#env.PLT_CACHE_CONFIG) {
      try {
        userConfig = JSON.parse(this.#env.PLT_CACHE_CONFIG)
      } catch (e) {
        this.#logger.error(
          { err: ensureLoggableError(e) },
          'Failed to parse user cache config'
        )
      }
    }

    if (!userConfig && !autoGeneratedConfig) return null

    let cacheConfig = userConfig ?? autoGeneratedConfig
    if (autoGeneratedConfig && userConfig) {
      cacheConfig = this.#mergeCacheConfigs(autoGeneratedConfig, userConfig)
    }

    const cacheTagsHeader = this.#getCacheTagsHeader(config)

    for (const rule of cacheConfig.rules ?? []) {
      if (rule.cacheTags) {
        if (!rule.headers) {
          rule.headers = {}
        }
        rule.headers[cacheTagsHeader] = rule.cacheTags
        delete rule.cacheTags
      }
    }

    return {
      module: this.#require.resolve('@platformatic/slicer-interceptor'),
      options: cacheConfig
    }
  }

  #mergeCacheConfigs (autoGeneratedConfig, userConfig) {
    const mergedConfig = { ...userConfig }

    for (const rule of autoGeneratedConfig.rules ?? []) {
      const ruleIndex = mergedConfig.rules.findIndex(
        r => r.routeToMatch === rule.routeToMatch
      )

      if (ruleIndex === -1) {
        mergedConfig.rules.push(rule)
      }
    }

    return mergedConfig
  }

  #configureTelemetry (config) {
    const enableOpenTelemetry =
      !!this.#instanceConfig?.enableOpenTelemetry &&
      !!this.#instanceConfig?.iccServices?.riskEngine?.url

    // We need to always set an opentelemetry config to pass a telemetry
    // serviceName to render a taxonomy diagram
    config.telemetry = config.telemetry ?? {
      enabled: enableOpenTelemetry,
      serviceName: this.#applicationName,
      skip: [
        { method: 'GET', path: '/documentation' },
        { method: 'GET', path: '/documentation/json' }
      ],
      exporter: {
        type: 'otlp',
        options: {
          url: this.#instanceConfig?.iccServices?.riskEngine?.url + '/v1/traces',
          headers: {
            'x-platformatic-application-id': this.#instanceConfig.applicationId
          },
          keepAlive: true,
          httpAgentOptions: {
            rejectUnauthorized: false
          }
        }
      }
    }
  }

  #configureHttpCaching (config) {
    const cacheTagsHeader = this.#getCacheTagsHeader(config)
    const httpCache = this.#instanceConfig?.httpCache?.clientOpts

    if (!httpCache?.host) {
      this.#logger.warn('Missing required environment variables for Redis cache, not setting up HTTP cache')
      return
    }

    config.httpCache = {
      ...config.httpCache,
      cacheTagsHeader,
      store: this.#require.resolve('@platformatic/undici-cache-redis'),
      clientOpts: httpCache
    }
  }

  #configureHealth (config) {
    config.health = {
      ...config.health,
      enabled: true,
      interval: 1000,
      maxUnhealthyChecks: 30
    }
  }

  #configureScheduler (config) {
    // Disable all watt schedules. We do that because
    // we will create/update them in ICC, not on watt in memory
    if (config.scheduler) {
      config.scheduler = config.scheduler.map(scheduler => ({
        ...scheduler,
        enabled: false
      }))
    }
  }

  #configureSystemResources (config) {
    if (!this.#instanceConfig) {
      return
    }
    // Set system wide resources
    const resources = this.#instanceConfig?.config?.resources
    if (!resources) {
      return
    }

    const {
      threads,
      heap
    } = resources

    if (threads > 0) {
      config.workers = threads
    }

    if (heap > 0) {
      config.health ??= {}
      config.health.maxHeapTotal = heap * 1024 * 1024
    }

    // Set services resources
    for (const service of config.services ?? []) {
      let serviceResources = resources.services?.find(s => s.name === service.id)

      if (!serviceResources) {
        serviceResources = {
          threads,
          heap
        }
      }
      service.workers = serviceResources.threads
      service.health ??= {}
      service.health.maxHeapTotal = serviceResources.heap * 1024 * 1024
    }
  }

  async #configureServices (runtime) {
    if (typeof runtime.setServiceConfigPatch !== 'function') {
      return
    }

    const config = runtime.getRuntimeConfig()

    for (const service of config.services) {
      if (service.type === 'next') {
        await this.#configureNextService(runtime, service)
      } else if (service.isPLTService && ['service', 'composer', 'db'].includes(service.type)) {
        await this.#configurePlatformaticServices(runtime, service, config)
      }
    }
  }

  async #configureNextService (runtime, service) {
    let nextSchema

    try {
      const nextPackage = createRequire(resolve(service.path, 'index.js')).resolve('@platformatic/next')
      nextSchema = JSON.parse(await readFile(resolve(nextPackage, '../schema.json'), 'utf8'))
    } catch (e) {
      this.#logger.error({ err: ensureLoggableError(e) }, `Failed to load @platformatic/next schema for service ${service.id}`)
      throw e
    }

    const patches = []

    if ('cache' in nextSchema.properties) {
      const httpCache = this.#instanceConfig?.httpCache?.clientOpts || {}
      const {
        keyPrefix,
        host,
        port,
        username,
        password
      } = httpCache

      if (!keyPrefix || !host || !port) {
        this.#logger.warn('Missing required environment variables for Redis cache, not setting up HTTP next cache')
      } else {
        patches.push({
          op: 'add',
          path: '/cache',
          value: {
            adapter: 'valkey',
            url: `valkey://${username}:${password}@${host}:${port}`,
            prefix: keyPrefix,
            maxTTL: 604800 // 86400 * 7
          }
        })
      }
    }

    // Add trailingSlash true to Next entrypoints that support it
    // This is technically useless as Next.js will manage it at build time, but we keep it
    // in case in the future they compare build and production next.config.js
    if (service.entrypoint && nextSchema.properties.next?.properties.trailingSlash?.type === 'boolean') {
      patches.push({ op: 'add', path: '/next/trailingSlash', value: true })
    }

    if (patches.length) {
      this.#patchService(runtime, service.id, patches)
    }
  }

  async #configurePlatformaticServices (runtime, service) {
    if (service.entrypoint) {
      const config = await this.#loadServiceConfiguration(service)
      const patches = [{ op: 'add', path: '/server/trustProxy', value: true }]

      if (!config.server) {
        patches.unshift({ op: 'add', path: '/server', value: {} })
      }

      patches.push({ op: 'remove', path: '/server/https' })

      this.#patchService(runtime, service.id, patches)
    }
  }

  async #patchService (runtime, id, patches) {
    this.#logger.info({ patches }, `Applying patches to service ${id} ...`)
    runtime.setServiceConfigPatch(id, patches)
  }

  async #loadServiceConfiguration (service) {
    const { ConfigManager, getParser } = this.#require('@platformatic/config')
    let configPath = service.config

    if (!configPath) {
      configPath = resolve(service.path, await ConfigManager.findConfigFile(service.path))
    }

    const parser = getParser(configPath)
    return parser(await readFile(resolve(service.path, configPath), 'utf8'))
  }

  #getCacheTagsHeader (config) {
    const customCacheTagsHeader = config.httpCache?.cacheTagsHeader
    const defaultCacheTagsHeader = this.#env.PLT_DEFAULT_CACHE_TAGS_HEADER
    return customCacheTagsHeader ?? defaultCacheTagsHeader
  }
}

export default WattPro

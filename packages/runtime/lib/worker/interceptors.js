'use strict'

const { join } = require('node:path')
const { workerData, parentPort } = require('node:worker_threads')
const { pathToFileURL } = require('node:url')
const { createRequire } = require('@platformatic/utils')
const { setGlobalDispatcher, Client, Pool, Agent } = require('undici')
const { wire } = require('undici-thread-interceptor')
const { createTelemetryThreadInterceptorHooks } = require('@platformatic/telemetry')
const { RemoteCacheStore, httpCacheInterceptor } = require('./http-cache')
const { kInterceptors } = require('./symbols')

async function setDispatcher (config, opts = {}) {
  const dispatcherOpts = await getDespatcherOpts(config.undici)

  let interceptors = globalThis[kInterceptors]
  if (!interceptors) {
    const threadDispatcher = createThreadInterceptor(config, opts)
    const threadInterceptor = threadDispatcher.interceptor

    let cacheInterceptor = null
    if (config.httpCache) {
      cacheInterceptor = createHttpCacheInterceptor(config)
    }

    interceptors = {
      threadDispatcher,
      threadInterceptor,
      cacheInterceptor
    }

    globalThis[kInterceptors] = interceptors
  }

  let userInterceptors = []
  if (Array.isArray(config.undici?.interceptors)) {
    const _require = createRequire(join(workerData.dirname, 'package.json'))
    userInterceptors = await loadInterceptors(_require, config.undici.interceptors)
  }

  setGlobalDispatcher(
    new Agent(dispatcherOpts).compose(
      [
        interceptors.threadInterceptor,
        interceptors.cacheInterceptor,
        ...userInterceptors
      ].filter(Boolean)
    )
  )

  return interceptors
}

async function getDespatcherOpts (undiciConfig) {
  const dispatcherOpts = { ...undiciConfig }

  const interceptorsConfigs = undiciConfig?.interceptors
  if (!interceptorsConfigs || Array.isArray(interceptorsConfigs)) {
    return dispatcherOpts
  }

  const _require = createRequire(join(workerData.dirname, 'package.json'))

  const clientInterceptors = []
  const poolInterceptors = []

  for (const key of ['Agent', 'Pool', 'Client']) {
    const interceptorConfig = undiciConfig.interceptors[key]
    if (!interceptorConfig) continue

    const interceptors = await loadInterceptors(_require, interceptorConfig)
    if (key === 'Agent') {
      clientInterceptors.push(...interceptors)
      poolInterceptors.push(...interceptors)
    }
    if (key === 'Pool') {
      poolInterceptors.push(...interceptors)
    }
    if (key === 'Client') {
      clientInterceptors.push(...interceptors)
    }
  }

  dispatcherOpts.factory = (origin, opts) => {
    return opts && opts.connections === 1
      ? new Client(origin, opts).compose(clientInterceptors)
      : new Pool(origin, opts).compose(poolInterceptors)
  }

  return dispatcherOpts
}

function createThreadInterceptor (config, opts) {
  const { telemetry } = opts
  const hooks = telemetry ? createTelemetryThreadInterceptorHooks() : {}
  const threadDispatcher = wire({
    // Specifying the domain is critical to avoid flooding the DNS
    // with requests for a domain that's never going to exist.
    domain: '.plt.local',
    port: parentPort,
    timeout: config.serviceTimeout,
    ...hooks
  })
  return threadDispatcher
}

function createHttpCacheInterceptor (config) {
  const cacheInterceptor = httpCacheInterceptor({
    store: new RemoteCacheStore({
      onRequest: opts => {
        globalThis.platformatic?.onHttpCacheRequest?.(opts)
      },
      onCacheHit: opts => {
        globalThis.platformatic?.onHttpCacheHit?.(opts)
      },
      onCacheMiss: opts => {
        globalThis.platformatic?.onHttpCacheMiss?.(opts)
      },
      logger: globalThis.platformatic.logger
    }),
    methods: config.httpCache.methods ?? ['GET', 'HEAD'],
    logger: globalThis.platformatic.logger
  })
  return cacheInterceptor
}

async function loadInterceptor (_require, module, options) {
  const url = pathToFileURL(_require.resolve(module))
  const interceptor = (await import(url)).default
  return interceptor(options)
}

function loadInterceptors (_require, interceptors) {
  return Promise.all(
    interceptors.map(async ({ module, options }) => {
      return loadInterceptor(_require, module, options)
    })
  )
}

module.exports = { setDispatcher }

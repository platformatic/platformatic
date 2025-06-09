'use strict'

const { join } = require('node:path')
const { workerData, parentPort } = require('node:worker_threads')
const { pathToFileURL } = require('node:url')
const { createRequire } = require('node:module')
const { setGlobalDispatcher, Client, Pool, Agent } = require('undici')
const { wire } = require('undici-thread-interceptor')
const { createTelemetryThreadInterceptorHooks } = require('@platformatic/telemetry')
const { RemoteCacheStore, httpCacheInterceptor } = require('./http-cache')
const { kInterceptors } = require('./symbols')

async function setDispatcher (runtimeConfig) {
  const threadDispatcher = createThreadInterceptor(runtimeConfig)
  const threadInterceptor = threadDispatcher.interceptor

  let cacheInterceptor = null
  if (runtimeConfig.httpCache) {
    cacheInterceptor = createHttpCacheInterceptor(runtimeConfig)
  }

  let userInterceptors = []
  if (Array.isArray(runtimeConfig.undici?.interceptors)) {
    const _require = createRequire(join(workerData.dirname, 'package.json'))
    userInterceptors = await loadInterceptors(_require, runtimeConfig.undici.interceptors)
  }

  const dispatcherOpts = await getDispatcherOpts(runtimeConfig.undici)

  setGlobalDispatcher(
    new Agent(dispatcherOpts).compose([threadInterceptor, ...userInterceptors, cacheInterceptor].filter(Boolean))
  )

  return { threadDispatcher }
}

async function updateUndiciInterceptors (undiciConfig) {
  const updatableInterceptors = globalThis[kInterceptors]
  if (!updatableInterceptors) return

  if (Array.isArray(undiciConfig?.interceptors)) {
    for (const interceptorConfig of undiciConfig.interceptors) {
      const { module, options } = interceptorConfig

      const interceptorCtx = updatableInterceptors[module]
      if (!interceptorCtx) continue

      const { createInterceptor, updateInterceptor } = interceptorCtx
      updateInterceptor(createInterceptor(options))
    }
  } else {
    for (const key of ['Agent', 'Pool', 'Client']) {
      const interceptorConfigs = undiciConfig.interceptors[key]
      if (!interceptorConfigs) continue

      for (const interceptorConfig of interceptorConfigs) {
        const { module, options } = interceptorConfig

        const interceptorCtx = updatableInterceptors[key][module]
        if (!interceptorCtx) continue

        const { createInterceptor, updateInterceptor } = interceptorCtx
        updateInterceptor(createInterceptor(options))
      }
    }
  }
}

function createUpdatableInterceptor (originInterceptor) {
  let originalDispatcher = null
  let originalDispatch = null

  function updatableInterceptor (dispatch) {
    originalDispatch = dispatch
    originalDispatcher = originInterceptor(dispatch)

    return function dispatcher (opts, handler) {
      return originalDispatcher(opts, handler)
    }
  }

  function updateInterceptor (newInterceptor) {
    originalDispatcher = newInterceptor(originalDispatch)
  }

  return { updatableInterceptor, updateInterceptor }
}

async function loadInterceptors (_require, interceptorsConfigs, key) {
  return Promise.all(
    interceptorsConfigs.map(async interceptorConfig => {
      return loadInterceptor(_require, interceptorConfig, key)
    })
  )
}

async function loadInterceptor (_require, interceptorConfig, key) {
  let updatableInterceptors = globalThis[kInterceptors]
  if (!updatableInterceptors) {
    updatableInterceptors = {}
    globalThis[kInterceptors] = updatableInterceptors
  }

  const { module, options } = interceptorConfig

  const url = pathToFileURL(_require.resolve(module))
  const createInterceptor = (await import(url)).default
  const interceptor = createInterceptor(options)

  const { updatableInterceptor, updateInterceptor } = createUpdatableInterceptor(interceptor)

  const interceptorCtx = { createInterceptor, updateInterceptor }

  if (key !== undefined) {
    if (!updatableInterceptors[key]) {
      updatableInterceptors[key] = {}
    }
    updatableInterceptors[key][module] = interceptorCtx
  } else {
    updatableInterceptors[module] = interceptorCtx
  }

  return updatableInterceptor
}

async function getDispatcherOpts (undiciConfig) {
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

    const interceptors = await loadInterceptors(_require, interceptorConfig, key)
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

function createThreadInterceptor (runtimeConfig) {
  const telemetry = runtimeConfig.telemetry

  const telemetryHooks = telemetry ? createTelemetryThreadInterceptorHooks() : {}

  const threadDispatcher = wire({
    // Specifying the domain is critical to avoid flooding the DNS
    // with requests for a domain that's never going to exist.
    domain: '.plt.local',
    port: parentPort,
    timeout: runtimeConfig.serviceTimeout,
    ...telemetryHooks,
  })
  return threadDispatcher
}

function createHttpCacheInterceptor (runtimeConfig) {
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
    methods: runtimeConfig.httpCache.methods ?? ['GET', 'HEAD'],
    logger: globalThis.platformatic.logger
  })
  return cacheInterceptor
}

module.exports = { setDispatcher, updateUndiciInterceptors }

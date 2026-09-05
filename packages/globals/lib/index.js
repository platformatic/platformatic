import { MissingGlobalError } from './errors.js'

const globalsPackage = '@platformatic/globals'
const kState = Symbol.for('plt.globals.state')

if (!globalThis[kState]) {
  Object.defineProperty(globalThis, kState, {
    value: { values: {}, fields: new Set(), initialized: false },
    enumerable: false
  })
}

const state = globalThis[kState]

export function externalizePlatformaticGlobals (nitro) {
  nitro.options.traceDeps ??= []
  if (!nitro.options.traceDeps.includes(globalsPackage)) {
    nitro.options.traceDeps.push(globalsPackage)
  }

  nitro.options.externals ??= {}
  nitro.options.externals.external ??= []
  if (!nitro.options.externals.external.includes(globalsPackage)) {
    nitro.options.externals.external.push(globalsPackage)
  }

  nitro.options.rollupConfig ??= {}
  const external = nitro.options.rollupConfig.external

  if (typeof external === 'function') {
    nitro.options.rollupConfig.external = (source, importer, isResolved) => {
      return source === globalsPackage || external(source, importer, isResolved)
    }
  } else if (Array.isArray(external)) {
    if (!external.includes(globalsPackage)) {
      external.push(globalsPackage)
    }
  } else if (external) {
    nitro.options.rollupConfig.external = [external, globalsPackage]
  } else {
    nitro.options.rollupConfig.external = [globalsPackage]
  }
}

function getField (name, options) {
  const { throwOnMissing = true } = options ?? {}

  if (throwOnMissing && !state.fields.has(name)) {
    throw new MissingGlobalError(name)
  }

  return state.values[name]
}

export function getGlobal () {
  return state.initialized ? state.values : undefined
}

export function updateGlobals (updates) {
  state.initialized = true

  for (const [key, value] of Object.entries(updates)) {
    state.values[key] = value
    state.fields.add(key)
  }

  return state.values
}

export function removeGlobals (names) {
  if (!state.initialized) {
    return undefined
  }

  for (const name of names) {
    delete state.values[name]
    state.fields.delete(name)
  }

  return state.values
}

export function hasField (name) {
  return state.fields.has(name)
}

export function isBuilding (options) {
  return getField('isBuilding', options)
}

export function getExecutable (options) {
  return getField('executable', options)
}

export function getRuntimeId (options) {
  return getField('runtimeId', options)
}

export function getNextVersion (options) {
  return getField('nextVersion', options)
}

export function getExitOnUnhandledErrors (options) {
  return getField('exitOnUnhandledErrors', options)
}

export function getReuseTcpPorts (options) {
  return getField('reuseTcpPorts', options)
}

export function getHost (options) {
  return getField('host', options)
}

export function getPort (options) {
  return getField('port', options)
}

export function getAdditionalServerOptions (options) {
  return getField('additionalServerOptions', options)
}

export function getTracingConfig (options) {
  return getField('tracingConfig', options)
}

export function getConfig (options) {
  return getField('config', options)
}

export function getRuntimeConfig (options) {
  return getField('runtimeConfig', options)
}

export function getApplicationConfig (options) {
  return getField('applicationConfig', options)
}

export function getApplicationId (options) {
  return getField('applicationId', options)
}

export function getWorkerId (options) {
  return getField('workerId', options)
}

export function getRoot (options) {
  return getField('root', options)
}

export function getBasePath (options) {
  return getField('basePath', options)
}

export function getRuntimeBasePath (options) {
  return getField('runtimeBasePath', options)
}

export function getWantsAbsoluteUrls (options) {
  return getField('wantsAbsoluteUrls', options)
}

export function getLogger (options) {
  return getField('logger', options)
}

export function getLogLevel (options) {
  return getField('logLevel', options)
}

export function getInterceptLogging (options) {
  return getField('interceptLogging', options)
}

export function getPrometheus (options) {
  return getField('prometheus', options)
}

export function getClientSpansAls (options) {
  return getField('clientSpansAls', options)
}

export function getInterceptors (options) {
  return getField('interceptors', options)
}

export function getValkeyClients (options) {
  return getField('valkeyClients', options)
}

export function getOnHttpCacheRequest (options) {
  return getField('onHttpCacheRequest', options)
}

export function getOnHttpCacheHit (options) {
  return getField('onHttpCacheHit', options)
}

export function getOnHttpCacheMiss (options) {
  return getField('onHttpCacheMiss', options)
}

export function getOnHttpStatsFree (options) {
  return getField('onHttpStatsFree', options)
}

export function getOnHttpStatsConnected (options) {
  return getField('onHttpStatsConnected', options)
}

export function getOnHttpStatsPending (options) {
  return getField('onHttpStatsPending', options)
}

export function getOnHttpStatsQueued (options) {
  return getField('onHttpStatsQueued', options)
}

export function getOnHttpStatsRunning (options) {
  return getField('onHttpStatsRunning', options)
}

export function getOnHttpStatsSize (options) {
  return getField('onHttpStatsSize', options)
}

export function getOnActiveResourcesEventLoop (options) {
  return getField('onActiveResourcesEventLoop', options)
}

export function getInvalidateHttpCache (options) {
  return getField('invalidateHttpCache', options)
}

export function setBasePath (...args) {
  return getField('setBasePath')(...args)
}

export function setOpenapiSchema (...args) {
  return getField('setOpenapiSchema')(...args)
}

export function setGraphqlSchema (...args) {
  return getField('setGraphqlSchema')(...args)
}

export function setConnectionString (...args) {
  return getField('setConnectionString')(...args)
}

export function setCustomHealthCheck (...args) {
  return getField('setCustomHealthCheck')(...args)
}

export function setCustomReadinessCheck (...args) {
  return getField('setCustomReadinessCheck')(...args)
}

export function getEvents (options) {
  return getField('events', options)
}

export function getITC (options) {
  return getField('itc', options)
}

export function getMessaging (options) {
  return getField('messaging', options)
}

export function getCapability (options) {
  return getField('capability', options)
}

export function getClosing (options) {
  return getField('closing', options)
}

export function getSharedContext (options) {
  return getField('sharedContext', options)
}

export function getManagement (options) {
  return getField('management', options)
}

export function getSendHealthSignal (options) {
  return getField('sendHealthSignal', options)
}

export function getTracingReady (options) {
  return getField('tracingReady', options)
}

export function getTracerProvider (options) {
  return getField('tracerProvider', options)
}

export function getNotifyConfig (options) {
  return getField('notifyConfig', options)
}

export * as errors from './errors.js'

export default getGlobal

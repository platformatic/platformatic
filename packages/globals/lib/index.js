export const kFields = Symbol.for('plt.globals.fields')

function getField (name, throwOnMissing = true) {
  if (throwOnMissing && !globalThis.platformatic?.[kFields]?.has(name)) {
    throw new Error(`globalThis.platformatic.${name} is not available`)
  }

  return globalThis.platformatic?.[name]
}

export function getGlobal () {
  return globalThis.platformatic
}

export function updateGlobals (updates) {
  globalThis.platformatic ??= {}
  globalThis.platformatic[kFields] ??= new Set()

  for (const [key, value] of Object.entries(updates)) {
    globalThis.platformatic[key] = value
    globalThis.platformatic[kFields].add(key)
  }

  return globalThis.platformatic
}

export function hasField (name) {
  return globalThis.platformatic?.[kFields]?.has(name) ?? false
}

export function isBuilding (throwOnMissing = true) {
  return getField('isBuilding', throwOnMissing)
}

export function getExecutable (throwOnMissing = true) {
  return getField('executable', throwOnMissing)
}

export function getRuntimeId (throwOnMissing = true) {
  return getField('runtimeId', throwOnMissing)
}

export function getNextVersion (throwOnMissing = true) {
  return getField('nextVersion', throwOnMissing)
}

export function getExitOnUnhandledErrors (throwOnMissing = true) {
  return getField('exitOnUnhandledErrors', throwOnMissing)
}

export function getReuseTcpPorts (throwOnMissing = true) {
  return getField('reuseTcpPorts', throwOnMissing)
}

export function getHost (throwOnMissing = true) {
  return getField('host', throwOnMissing)
}

export function getPort (throwOnMissing = true) {
  return getField('port', throwOnMissing)
}

export function getAdditionalServerOptions (throwOnMissing = true) {
  return getField('additionalServerOptions', throwOnMissing)
}

export function getTelemetryConfig (throwOnMissing = true) {
  return getField('telemetryConfig', throwOnMissing)
}

export function getConfig (throwOnMissing = true) {
  return getField('config', throwOnMissing)
}

export function getApplicationId (throwOnMissing = true) {
  return getField('applicationId', throwOnMissing)
}

export function getWorkerId (throwOnMissing = true) {
  return getField('workerId', throwOnMissing)
}

export function getRoot (throwOnMissing = true) {
  return getField('root', throwOnMissing)
}

export function isEntrypoint (throwOnMissing = true) {
  return getField('isEntrypoint', throwOnMissing)
}

export function getBasePath (throwOnMissing = true) {
  return getField('basePath', throwOnMissing)
}

export function getRuntimeBasePath (throwOnMissing = true) {
  return getField('runtimeBasePath', throwOnMissing)
}

export function getWantsAbsoluteUrls (throwOnMissing = true) {
  return getField('wantsAbsoluteUrls', throwOnMissing)
}

export function getLogger (throwOnMissing = true) {
  return getField('logger', throwOnMissing)
}

export function getLogLevel (throwOnMissing = true) {
  return getField('logLevel', throwOnMissing)
}

export function getInterceptLogging (throwOnMissing = true) {
  return getField('interceptLogging', throwOnMissing)
}

export function getPrometheus (throwOnMissing = true) {
  return getField('prometheus', throwOnMissing)
}

export function getClientSpansAls (throwOnMissing = true) {
  return getField('clientSpansAls', throwOnMissing)
}

export function getInterceptors (throwOnMissing = true) {
  return getField('interceptors', throwOnMissing)
}

export function getValkeyClients (throwOnMissing = true) {
  return getField('valkeyClients', throwOnMissing)
}

export function getOnHttpCacheRequest (throwOnMissing = true) {
  return getField('onHttpCacheRequest', throwOnMissing)
}

export function getOnHttpCacheHit (throwOnMissing = true) {
  return getField('onHttpCacheHit', throwOnMissing)
}

export function getOnHttpCacheMiss (throwOnMissing = true) {
  return getField('onHttpCacheMiss', throwOnMissing)
}

export function getOnHttpStatsFree (throwOnMissing = true) {
  return getField('onHttpStatsFree', throwOnMissing)
}

export function getOnHttpStatsConnected (throwOnMissing = true) {
  return getField('onHttpStatsConnected', throwOnMissing)
}

export function getOnHttpStatsPending (throwOnMissing = true) {
  return getField('onHttpStatsPending', throwOnMissing)
}

export function getOnHttpStatsQueued (throwOnMissing = true) {
  return getField('onHttpStatsQueued', throwOnMissing)
}

export function getOnHttpStatsRunning (throwOnMissing = true) {
  return getField('onHttpStatsRunning', throwOnMissing)
}

export function getOnHttpStatsSize (throwOnMissing = true) {
  return getField('onHttpStatsSize', throwOnMissing)
}

export function getOnActiveResourcesEventLoop (throwOnMissing = true) {
  return getField('onActiveResourcesEventLoop', throwOnMissing)
}

export function getInvalidateHttpCache (throwOnMissing = true) {
  return getField('invalidateHttpCache', throwOnMissing)
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

export function getEvents (throwOnMissing = true) {
  return getField('events', throwOnMissing)
}

export function getITC (throwOnMissing = true) {
  return getField('itc', throwOnMissing)
}

export function getMessaging (throwOnMissing = true) {
  return getField('messaging', throwOnMissing)
}

export function getCapability (throwOnMissing = true) {
  return getField('capability', throwOnMissing)
}

export function getClosing (throwOnMissing = true) {
  return getField('closing', throwOnMissing)
}

export function getSharedContext (throwOnMissing = true) {
  return getField('sharedContext', throwOnMissing)
}

export function getManagement (throwOnMissing = true) {
  return getField('management', throwOnMissing)
}

export function getSendHealthSignal (throwOnMissing = true) {
  return getField('sendHealthSignal', throwOnMissing)
}

export function getTelemetryReady (throwOnMissing = true) {
  return getField('telemetryReady', throwOnMissing)
}

export function getTracerProvider (throwOnMissing = true) {
  return getField('tracerProvider', throwOnMissing)
}

export function getNotifyConfig (throwOnMissing = true) {
  return getField('notifyConfig', throwOnMissing)
}

export default getGlobal

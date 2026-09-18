import { deepStrictEqual, strictEqual, throws } from 'node:assert'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import * as globals from '../lib/index.js'

const require = createRequire(import.meta.url)

test('getGlobal should be undefined before initialization', async () => {
  const isolated = await import('../lib/index.js?uninitialized')

  strictEqual(isolated.getGlobal(), undefined)
  deepStrictEqual(isolated.getGlobals(), {})
  throws(() => isolated.getGlobals('logger'), { code: 'PLT_GLOBALS_MISSING_FIELD' })
})

test('getters should return global fields', () => {
  const values = {
    isBuilding: false,
    executable: 'platformatic',
    runtimeId: 7,
    nextVersion: { major: 16 },
    exitOnUnhandledErrors: true,
    reuseTcpPorts: false,
    host: '127.0.0.1',
    port: 3042,
    additionalServerOptions: {},
    tracingConfig: {},
    config: {},
    runtimeConfig: {},
    applicationConfig: {},
    applicationId: 'application',
    workerId: 1,
    root: '/tmp/application',
    basePath: '/base',
    runtimeBasePath: '/runtime',
    wantsAbsoluteUrls: false,
    logger: {},
    logLevel: 'info',
    interceptLogging: true,
    prometheus: {},
    clientSpansAls: {},
    interceptors: {},
    valkeyClients: new Map(),
    onHttpCacheRequest: () => {},
    onHttpCacheHit: () => {},
    onHttpCacheMiss: () => {},
    onHttpStatsFree: () => {},
    onHttpStatsConnected: () => {},
    onHttpStatsPending: () => {},
    onHttpStatsQueued: () => {},
    onHttpStatsRunning: () => {},
    onHttpStatsSize: () => {},
    onActiveResourcesEventLoop: () => {},
    invalidateHttpCache: () => {},
    setBasePath: () => {},
    setOpenapiSchema: () => {},
    setGraphqlSchema: () => {},
    setConnectionString: () => {},
    setCustomHealthCheck: () => {},
    setCustomReadinessCheck: () => {},
    events: {},
    itc: {},
    messaging: {},
    capability: {},
    closing: true,
    sharedContext: {},
    management: {},
    sendHealthSignal: () => {},
    tracingReady: Promise.resolve(),
    tracerProvider: {},
    notifyConfig: () => {}
  }

  globals.updateGlobals(values)

  strictEqual(globals.isBuilding(), values.isBuilding)
  strictEqual(globals.getExecutable(), values.executable)
  strictEqual(globals.getRuntimeId(), values.runtimeId)
  strictEqual(globals.getNextVersion(), values.nextVersion)
  strictEqual(globals.getExitOnUnhandledErrors(), values.exitOnUnhandledErrors)
  strictEqual(globals.getReuseTcpPorts(), values.reuseTcpPorts)
  strictEqual(globals.getHost(), values.host)
  strictEqual(globals.getPort(), values.port)
  strictEqual(globals.getAdditionalServerOptions(), values.additionalServerOptions)
  strictEqual(globals.getTracingConfig(), values.tracingConfig)
  strictEqual(globals.getConfig(), values.config)
  strictEqual(globals.getRuntimeConfig(), values.runtimeConfig)
  strictEqual(globals.getApplicationConfig(), values.applicationConfig)
  strictEqual(globals.getApplicationId(), values.applicationId)
  strictEqual(globals.getWorkerId(), values.workerId)
  strictEqual(globals.getRoot(), values.root)
  strictEqual(globals.getBasePath(), values.basePath)
  strictEqual(globals.getRuntimeBasePath(), values.runtimeBasePath)
  strictEqual(globals.getWantsAbsoluteUrls(), values.wantsAbsoluteUrls)
  strictEqual(globals.getLogger(), values.logger)
  strictEqual(globals.getLogLevel(), values.logLevel)
  strictEqual(globals.getInterceptLogging(), values.interceptLogging)
  strictEqual(globals.getPrometheus(), values.prometheus)
  strictEqual(globals.getClientSpansAls(), values.clientSpansAls)
  strictEqual(globals.getInterceptors(), values.interceptors)
  strictEqual(globals.getValkeyClients(), values.valkeyClients)
  strictEqual(globals.getOnHttpCacheRequest(), values.onHttpCacheRequest)
  strictEqual(globals.getOnHttpCacheHit(), values.onHttpCacheHit)
  strictEqual(globals.getOnHttpCacheMiss(), values.onHttpCacheMiss)
  strictEqual(globals.getOnHttpStatsFree(), values.onHttpStatsFree)
  strictEqual(globals.getOnHttpStatsConnected(), values.onHttpStatsConnected)
  strictEqual(globals.getOnHttpStatsPending(), values.onHttpStatsPending)
  strictEqual(globals.getOnHttpStatsQueued(), values.onHttpStatsQueued)
  strictEqual(globals.getOnHttpStatsRunning(), values.onHttpStatsRunning)
  strictEqual(globals.getOnHttpStatsSize(), values.onHttpStatsSize)
  strictEqual(globals.getOnActiveResourcesEventLoop(), values.onActiveResourcesEventLoop)
  strictEqual(globals.getInvalidateHttpCache(), values.invalidateHttpCache)
  strictEqual(globals.setBasePath('base-path'), undefined)
  strictEqual(globals.setOpenapiSchema({}), undefined)
  strictEqual(globals.setGraphqlSchema({}), undefined)
  strictEqual(globals.setConnectionString('connection-string'), undefined)
  strictEqual(globals.setCustomHealthCheck(() => true), undefined)
  strictEqual(globals.setCustomReadinessCheck(() => true), undefined)
  strictEqual(globals.getEvents(), values.events)
  strictEqual(globals.getITC(), values.itc)
  strictEqual(globals.getMessaging(), values.messaging)
  strictEqual(globals.getCapability(), values.capability)
  strictEqual(globals.getClosing(), values.closing)
  strictEqual(globals.getSharedContext(), values.sharedContext)
  strictEqual(globals.getManagement(), values.management)
  strictEqual(globals.getSendHealthSignal(), values.sendHealthSignal)
  strictEqual(globals.getTracingReady(), values.tracingReady)
  strictEqual(globals.getTracerProvider(), values.tracerProvider)
  strictEqual(globals.getNotifyConfig(), values.notifyConfig)
})

test('updateGlobals should merge and return global fields', () => {
  const original = globals.updateGlobals({ logger: {} })

  const updated = globals.updateGlobals({ config: { hello: 'world' } })

  strictEqual(updated, original)
  deepStrictEqual(updated.config, { hello: 'world' })
  strictEqual(Object.getOwnPropertySymbols(globalThis).includes(Symbol.for('plt.globals.state')), true)
  strictEqual(Object.hasOwn(globals, 'kState'), false)
  strictEqual(Object.hasOwn(globalThis, 'platformatic'), false)
})

test('CommonJS and ESM entrypoints should share global fields', () => {
  const commonjs = require('@platformatic/globals')
  const logger = {}

  globals.updateGlobals({ logger })

  strictEqual(commonjs.getLogger(), logger)
})

test('removeGlobals should remove global fields', () => {
  globals.updateGlobals({ messaging: {}, logger: {} })

  strictEqual(globals.hasField('messaging'), true)
  strictEqual(globals.hasField('logger'), true)

  const updated = globals.removeGlobals(['messaging'])

  strictEqual(updated, globals.getGlobal())
  strictEqual(globals.hasField('messaging'), false)
  strictEqual(globals.hasField('logger'), true)
  strictEqual(updated.messaging, undefined)
  throws(() => globals.getMessaging(), { code: 'PLT_GLOBALS_MISSING_FIELD' })
})

test('removeGlobals should be noop without initialized state', () => {
  return import('../lib/index.js?without-global').then(isolated => {
    strictEqual(isolated.removeGlobals(['missing']), isolated.getGlobal())
  })
})

test('getters should throw when global fields are not available', () => {
  globals.removeGlobals(['logger'])
  throws(() => globals.getLogger(), { code: 'PLT_GLOBALS_MISSING_FIELD' })
})

test('getters should return undefined when throwOnMissing is false', () => {
  globals.removeGlobals(['logger'])
  strictEqual(globals.getLogger({ throwOnMissing: false }), undefined)
})

test('separate module instances should share global values', async () => {
  const isolated = await import('../lib/index.js?isolated')

  isolated.updateGlobals({ logger: { isolated: true } })

  strictEqual(globals.getLogger().isolated, true)
  strictEqual(isolated.getLogger().isolated, true)
})

test('getGlobals selects fields without exposing the globals container', t => {
  const logger = { name: 'original' }
  globals.updateGlobals({ logger, applicationId: 'app', config: {} })
  t.after(() => globals.removeGlobals(['logger', 'applicationId', 'config']))

  const selected = globals.getGlobals('logger', 'applicationId', 'logger')
  deepStrictEqual(Object.keys(selected), ['logger', 'applicationId'])
  strictEqual(selected.logger, logger)
  strictEqual(selected.applicationId, 'app')

  selected.logger = { name: 'replacement' }
  delete selected.applicationId
  strictEqual(globals.getLogger(), logger)
  strictEqual(globals.getApplicationId(), 'app')
  deepStrictEqual(globals.getGlobals(), {})
})

test('getGlobals distinguishes registered undefined values from missing fields', t => {
  globals.updateGlobals({ config: undefined })
  t.after(() => globals.removeGlobals(['config']))

  deepStrictEqual(globals.getGlobals('config'), { config: undefined })
  throws(() => globals.getGlobals('config', 'unknown'), { code: 'PLT_GLOBALS_MISSING_FIELD' })
  throws(() => globals.getGlobals('constructor'), { code: 'PLT_GLOBALS_MISSING_FIELD' })

  globals.removeGlobals(['config'])
  throws(() => globals.getGlobals('config'), { code: 'PLT_GLOBALS_MISSING_FIELD' })
})

test('interceptor setter initializes and replaces the named global', async t => {
  globals.removeGlobals(['undiciThreadInterceptor'])
  t.after(() => globals.removeGlobals(['undiciThreadInterceptor']))
  throws(() => globals.getUndiciThreadInterceptor(), { code: 'PLT_GLOBALS_MISSING_FIELD' })
  strictEqual(globals.getUndiciThreadInterceptor({ throwOnMissing: false }), undefined)

  const interceptor = { createUpgradeAgent () {} }
  strictEqual(globals.setUndiciThreadInterceptor(interceptor), undefined)
  strictEqual(globals.hasField('undiciThreadInterceptor'), true)
  strictEqual(globals.getUndiciThreadInterceptor(), interceptor)

  const isolated = await import('../lib/index.js?interceptor')
  strictEqual(isolated.getUndiciThreadInterceptor(), interceptor)
  const replacement = { createUpgradeAgent () {} }
  isolated.setUndiciThreadInterceptor(replacement)
  strictEqual(globals.getUndiciThreadInterceptor(), replacement)
})

test('child context getters support missing and registered values', t => {
  const fields = ['compileCache', 'resourceLimits']
  globals.removeGlobals(fields)
  t.after(() => globals.removeGlobals(fields))

  for (const getter of [globals.getCompileCache, globals.getResourceLimits]) {
    throws(() => getter(), { code: 'PLT_GLOBALS_MISSING_FIELD' })
    strictEqual(getter({ throwOnMissing: false }), undefined)
  }

  const compileCache = { enabled: true, directory: '.plt/compile-cache' }
  const resourceLimits = { maxOldGenerationSizeMb: 256 }
  globals.updateGlobals({ compileCache, resourceLimits })
  strictEqual(globals.getCompileCache(), compileCache)
  strictEqual(globals.getResourceLimits(), resourceLimits)

  globals.updateGlobals({ compileCache: false, resourceLimits: undefined })
  strictEqual(globals.getCompileCache(), false)
  strictEqual(globals.getResourceLimits(), undefined)
})

test('close callbacks should be registered and consumed in registration order', () => {
  const first = async () => {}
  const second = async () => {}

  globals.registerCloseCallback(first)
  globals.registerCloseCallback(second)

  strictEqual(globals.hasCloseCallbacks(), true)
  deepStrictEqual(globals.consumeCloseCallbacks(), [first, second])
  strictEqual(globals.hasCloseCallbacks(), false)
})

test('registerCloseCallback should reject invalid callbacks with a code', () => {
  throws(() => globals.registerCloseCallback('invalid'), { code: 'PLT_GLOBALS_INVALID_CLOSE_CALLBACK' })
})

test('registerCloseCallback should reject registrations after shutdown starts', () => {
  globals.consumeCloseCallbacks()
  throws(() => globals.registerCloseCallback(async () => {}), {
    code: 'PLT_GLOBALS_CLOSE_CALLBACK_REGISTRATION_CLOSED'
  })
})

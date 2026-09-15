import * as Client from '@platformatic/prom-client'
import type { AsyncLocalStorage } from 'node:async_hooks'
import type { Agent } from 'node:http'
import type { ResourceLimits } from 'node:worker_threads'
import type Pino from 'pino'
import { expect, test } from 'tstyche'
import * as globals from '../../lib/index.js'
import { type CloseCallback, type Management, type PlatformaticEvents, type PlatformaticGlobal } from '../../lib/index.js'

test("PlatformaticGlobal", () => {
  const platformatic = {} as PlatformaticGlobal
  expect(platformatic).type.toBe<PlatformaticGlobal>()

  // Runtime
  expect(platformatic.isBuilding).type.toBe<boolean>()
  expect(platformatic.executable).type.toBe<string>()
  expect(platformatic.runtimeId).type.toBe<number>()
  expect(platformatic.nextVersion).type.toBe<{ major: number, minor?: number }>()
  expect(platformatic.exitOnUnhandledErrors).type.toBe<boolean | number>()
  expect(platformatic.reuseTcpPorts).type.toBe<boolean>()

  // Service configuration
  expect(platformatic.host).type.toBe<string | true>()
  expect(platformatic.port).type.toBe<number | true>()
  expect(platformatic.additionalServerOptions).type.toBe<object>()
  expect(platformatic.tracingConfig).type.toBe<object>()
  expect(platformatic.config).type.toBe<object>()
  expect(platformatic.runtimeConfig).type.toBe<object>()
  expect(platformatic.applicationConfig).type.toBe<object | null>()
  expect(platformatic.applicationId).type.toBe<string>()
  expect(platformatic.workerId).type.toBe<number | string>()
  expect(platformatic.root).type.toBe<string>()
  expect(platformatic.basePath).type.toBe<string | null>()
  expect(platformatic.runtimeBasePath).type.toBe<string | null>()
  expect(platformatic.wantsAbsoluteUrls).type.toBe<boolean>()
  
  // Logging
  expect(platformatic.logger).type.toBe<Pino.Logger>()
  expect(platformatic.logLevel).type.toBe<Pino.Level>()
  expect(platformatic.interceptLogging).type.toBe<boolean>()

  // Metrics
  expect(platformatic.prometheus.client).type.toBe(Client)
  expect(platformatic.prometheus.registry).type.toBe<Client.Registry>()
  expect(platformatic.clientSpansAls).type.toBe<AsyncLocalStorage<unknown>>();
  expect(platformatic.interceptors).type.toBe<Record<string, any>>()
  expect(platformatic.valkeyClients).type.toBe<Map<string, any>>()
});

test("updateGlobals", () => {
  expect(globals.updateGlobals({ config: {} })).type.toBe<PlatformaticGlobal>()
  expect(globals.updateGlobals).type.toBeCallableWith({ logger: {} as Pino.Logger })
  expect(globals.updateGlobals).type.not.toBeCallableWith({ unknown: true })
})

test('getGlobals', () => {
  expect(globals.getGlobals()).type.toBe<Record<string, unknown>>()
  expect(globals.getGlobals('logger', 'applicationId')).type.toBe<Record<string, unknown>>()
  expect(globals.getGlobals).type.toBeCallableWith(...([] as string[]))
  expect(globals.getGlobals).type.not.toBeCallableWith(['logger'])
  expect(globals.getGlobals).type.not.toBeCallableWith(1)
})

test('interceptor and child context accessors', () => {
  const interceptor = {} as globals.UndiciThreadInterceptor
  expect(globals.setUndiciThreadInterceptor(interceptor)).type.toBe<void>()
  expect(globals.setUndiciThreadInterceptor).type.not.toBeCallableWith({})
  expect(globals.getUndiciThreadInterceptor()).type.toBe<globals.UndiciThreadInterceptor>()
  expect(globals.getUndiciThreadInterceptor().createUpgradeAgent()).type.toBe<Agent>()
  expect(globals.getUndiciThreadInterceptor({ throwOnMissing: false })).type.toBe<globals.UndiciThreadInterceptor | undefined>()
  expect(globals.getUndiciThreadInterceptor({} as globals.GlobalGetterOptions)).type.toBe<globals.UndiciThreadInterceptor | undefined>()
  expect(globals.updateGlobals).type.toBeCallableWith({ undiciThreadInterceptor: interceptor })
  expect(globals.getCompileCache()).type.toBe<boolean | { enabled?: boolean; directory?: string } | undefined>()
  expect(globals.getCompileCache({ throwOnMissing: false })).type.toBe<PlatformaticGlobal['compileCache']>()
  expect(globals.getResourceLimits()).type.toBe<ResourceLimits | undefined>()
  expect(globals.getResourceLimits({ throwOnMissing: false })).type.toBe<ResourceLimits | undefined>()
  expect(globals.updateGlobals).type.toBeCallableWith({ host: true, port: true })
  expect(globals.updateGlobals).type.not.toBeCallableWith({ host: false, port: false })
})

test("getters", () => {
  expect(globals.isBuilding()).type.toBe<PlatformaticGlobal['isBuilding']>()
  expect(globals.getExecutable()).type.toBe<PlatformaticGlobal['executable']>()
  expect(globals.getRuntimeId()).type.toBe<PlatformaticGlobal['runtimeId']>()
  expect(globals.getNextVersion()).type.toBe<PlatformaticGlobal['nextVersion']>()
  expect(globals.getExitOnUnhandledErrors()).type.toBe<PlatformaticGlobal['exitOnUnhandledErrors']>()
  expect(globals.getReuseTcpPorts()).type.toBe<PlatformaticGlobal['reuseTcpPorts']>()
  expect(globals.getHost()).type.toBe<PlatformaticGlobal['host']>()
  expect(globals.getPort()).type.toBe<PlatformaticGlobal['port']>()
  expect(globals.getAdditionalServerOptions()).type.toBe<PlatformaticGlobal['additionalServerOptions']>()
  expect(globals.getTracingConfig()).type.toBe<PlatformaticGlobal['tracingConfig']>()
  expect(globals.getConfig()).type.toBe<PlatformaticGlobal['config']>()
  expect(globals.getRuntimeConfig()).type.toBe<PlatformaticGlobal['runtimeConfig']>()
  expect(globals.getApplicationConfig()).type.toBe<PlatformaticGlobal['applicationConfig']>()
  expect(globals.getApplicationId()).type.toBe<PlatformaticGlobal['applicationId']>()
  expect(globals.getWorkerId()).type.toBe<PlatformaticGlobal['workerId']>()
  expect(globals.getRoot()).type.toBe<PlatformaticGlobal['root']>()
  expect(globals.getBasePath()).type.toBe<PlatformaticGlobal['basePath']>()
  expect(globals.getRuntimeBasePath()).type.toBe<PlatformaticGlobal['runtimeBasePath']>()
  expect(globals.getWantsAbsoluteUrls()).type.toBe<PlatformaticGlobal['wantsAbsoluteUrls']>()
  expect(globals.getLogger()).type.toBe<PlatformaticGlobal['logger']>()
  expect(globals.getLogger({ throwOnMissing: true })).type.toBe<PlatformaticGlobal['logger']>()
  expect(globals.getLogger({ throwOnMissing: false })).type.toBe<PlatformaticGlobal['logger'] | undefined>()
  expect(globals.getLogger).type.not.toBeCallableWith(false)
  expect(globals.getLogLevel()).type.toBe<PlatformaticGlobal['logLevel']>()
  expect(globals.getInterceptLogging()).type.toBe<PlatformaticGlobal['interceptLogging']>()
  expect(globals.getPrometheus()).type.toBe<PlatformaticGlobal['prometheus']>()
  expect(globals.getClientSpansAls()).type.toBe<PlatformaticGlobal['clientSpansAls']>()
  expect(globals.getInterceptors()).type.toBe<PlatformaticGlobal['interceptors']>()
  expect(globals.getValkeyClients()).type.toBe<PlatformaticGlobal['valkeyClients']>()
  expect(globals.getOnHttpCacheRequest()).type.toBe<PlatformaticGlobal['onHttpCacheRequest']>()
  expect(globals.getOnHttpCacheHit()).type.toBe<PlatformaticGlobal['onHttpCacheHit']>()
  expect(globals.getOnHttpCacheMiss()).type.toBe<PlatformaticGlobal['onHttpCacheMiss']>()
  expect(globals.getOnHttpStatsFree()).type.toBe<PlatformaticGlobal['onHttpStatsFree']>()
  expect(globals.getOnHttpStatsConnected()).type.toBe<PlatformaticGlobal['onHttpStatsConnected']>()
  expect(globals.getOnHttpStatsPending()).type.toBe<PlatformaticGlobal['onHttpStatsPending']>()
  expect(globals.getOnHttpStatsQueued()).type.toBe<PlatformaticGlobal['onHttpStatsQueued']>()
  expect(globals.getOnHttpStatsRunning()).type.toBe<PlatformaticGlobal['onHttpStatsRunning']>()
  expect(globals.getOnHttpStatsSize()).type.toBe<PlatformaticGlobal['onHttpStatsSize']>()
  expect(globals.getOnActiveResourcesEventLoop()).type.toBe<PlatformaticGlobal['onActiveResourcesEventLoop']>()
  expect(globals.getInvalidateHttpCache()).type.toBe<PlatformaticGlobal['invalidateHttpCache']>()
  expect(globals.setBasePath).type.toBe<PlatformaticGlobal['setBasePath']>()
  expect(globals.setOpenapiSchema).type.toBe<PlatformaticGlobal['setOpenapiSchema']>()
  expect(globals.setGraphqlSchema).type.toBe<PlatformaticGlobal['setGraphqlSchema']>()
  expect(globals.setConnectionString).type.toBe<PlatformaticGlobal['setConnectionString']>()
  expect(globals.setCustomHealthCheck).type.toBe<PlatformaticGlobal['setCustomHealthCheck']>()
  expect(globals.setCustomReadinessCheck).type.toBe<PlatformaticGlobal['setCustomReadinessCheck']>()
  expect(globals.getEvents()).type.toBe<PlatformaticEvents>()
  expect(globals.getITC()).type.toBe<PlatformaticGlobal['itc']>()
  expect(globals.getITC().process('message', { ok: true })).type.toBe<Promise<any>>()
  expect(globals.getMessaging()).type.toBe<PlatformaticGlobal['messaging']>()
  expect(globals.getCapability()).type.toBe<PlatformaticGlobal['capability']>()
  expect(globals.getClosing()).type.toBe<PlatformaticGlobal['closing']>()
  expect(globals.getSharedContext()).type.toBe<PlatformaticGlobal['sharedContext']>()
  expect(globals.getManagement()).type.toBe<Management>()
  expect(globals.getSendHealthSignal()).type.toBe<PlatformaticGlobal['sendHealthSignal']>()
  expect(globals.getTracingReady()).type.toBe<PlatformaticGlobal['tracingReady']>()
  expect(globals.getTracerProvider()).type.toBe<PlatformaticGlobal['tracerProvider']>()
  expect(globals.getNotifyConfig()).type.toBe<PlatformaticGlobal['notifyConfig']>()
})

test('close callbacks', () => {
  expect(globals.registerCloseCallback).type.toBeCallableWith(async () => {})
  expect(globals.registerCloseCallback).type.not.toBeCallableWith('invalid')
  expect(globals.consumeCloseCallbacks()).type.toBe<CloseCallback[]>()
  expect(globals.hasCloseCallbacks()).type.toBe<boolean>()
})

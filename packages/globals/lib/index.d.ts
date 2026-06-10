import { type TracerProvider } from '@opentelemetry/api'
import * as Client from '@platformatic/prom-client'
import { AsyncLocalStorage } from 'node:async_hooks'
import { type EventEmitter } from 'node:events'
import { type Level, type Logger } from 'pino'

export type Handler = (data: any, context?: Record<string, any>) => any | Promise<any>

export interface InvalidateHttpCacheOptions {
  keys?: string[]
  tags?: string[]
}

export interface HealthSignal {
  type: string
  value?: any
  description?: string
  timestamp?: number
}

export interface SharedContext {
  get (): any
  update (contextUpdate: object, options?: { overwrite?: boolean }): any
}

export type Management = Record<string, (...args: any[]) => any>

export interface GlobalGetterOptions {
  throwOnMissing?: boolean
}

export interface RequiredGlobalGetterOptions {
  throwOnMissing?: true
}

export interface OptionalGlobalGetterOptions {
  throwOnMissing: false
}

// This is purposely a copy of the one in @platformatic/itc to avoid the dependency
export interface ITC {
  send (message: string, data: any, options?: Record<string, any>): Promise<any>
  notify (message: string, data: any, options?: Record<string, any>): void
  process (message: string, data: any, context?: Record<string, any>): Promise<any>
  handle (message: string, handler: Handler): void
  getHandler (message: string): Handler | undefined
  listen (): void
  close (): void
}

export interface MessagingApi {
  send (name: string, message: string, data?: any, options?: Record<string, any>): Promise<any>
  notify (name: string, message: string, data?: any, options?: Record<string, any>): void
  handle (message: string, handler: Handler): void
  handle (handlers: Record<string, Handler>): void
}

export interface PlatformaticEvents extends EventEmitter {
  emitAndNotify: EventEmitter['emit']
}

export interface PlatformaticGlobal {
  // Runtime
  isBuilding: boolean
  executable: string
  runtimeId: number
  nextVersion: { major: number, minor?: number }
  exitOnUnhandledErrors: boolean
  reuseTcpPorts: boolean

  // Service configuration
  host: string
  port: number
  additionalServerOptions: object
  telemetryConfig: object
  config: object
  applicationId: string
  workerId: number | string
  root: string
  isEntrypoint: boolean
  basePath: string | null
  runtimeBasePath: string | null
  wantsAbsoluteUrls: boolean

  // Logging
  logger: Logger
  logLevel: Level
  interceptLogging: boolean

  // Metrics
  prometheus: {
    client: typeof Client
    registry: Client.Registry
  }
  clientSpansAls: InstanceType<typeof AsyncLocalStorage>
  interceptors: Record<string, any>
  valkeyClients: Map<string, any>

  // Caching
  onHttpCacheRequest (key: string): void
  onHttpCacheHit (key: string): void
  onHttpCacheMiss (key: string): void
  onHttpStatsFree (url: string, value: number): void
  onHttpStatsConnected (url: string, value: number): void
  onHttpStatsPending (url: string, value: number): void
  onHttpStatsQueued (url: string, value: number): void
  onHttpStatsRunning (url: string, value: number): void
  onHttpStatsSize (url: string, value: number): void
  onActiveResourcesEventLoop (value: number): void
  invalidateHttpCache (options: InvalidateHttpCacheOptions): void

  // Setters
  setBasePath (path: string): void
  setOpenapiSchema (schema: object): void
  setGraphqlSchema (schema: object): void
  setConnectionString (connection: string): void
  setCustomHealthCheck (
    healthCheck: () =>
      | boolean
      | Promise<boolean>
      | { status: boolean; statusCode?: number; body?: string }
      | Promise<{ status: boolean; statusCode?: number; body?: string }>
  ): void
  setCustomReadinessCheck (
    readinessCheck: () =>
      | boolean
      | Promise<boolean>
      | { status: boolean; statusCode?: number; body?: string }
      | Promise<{ status: boolean; statusCode?: number; body?: string }>
  ): void

  events: PlatformaticEvents
  itc: ITC
  messaging: MessagingApi
  capability: object
  closing: boolean
  sharedContext: SharedContext
  management: Management
  sendHealthSignal (signal: HealthSignal): Promise<void>
  telemetryReady: Promise<void>
  tracerProvider: TracerProvider
  notifyConfig (config: object): void
}

/** @deprecated Use `PlatformaticGlobal` instead. */
export type PlatformaticGlobalInterface = PlatformaticGlobal

export declare function getGlobal<T extends {}> (): (PlatformaticGlobal & T) | undefined
export declare function updateGlobals (updates: Partial<PlatformaticGlobal>): PlatformaticGlobal
export declare function removeGlobals (fields: string[]): PlatformaticGlobal | undefined
export declare function hasField (name: string): boolean
export declare function isBuilding (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['isBuilding']
export declare function isBuilding (options: OptionalGlobalGetterOptions): PlatformaticGlobal['isBuilding'] | undefined
export declare function isBuilding (options: GlobalGetterOptions): PlatformaticGlobal['isBuilding'] | undefined
export declare function getExecutable (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['executable']
export declare function getExecutable (options: OptionalGlobalGetterOptions): PlatformaticGlobal['executable'] | undefined
export declare function getExecutable (options: GlobalGetterOptions): PlatformaticGlobal['executable'] | undefined
export declare function getRuntimeId (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['runtimeId']
export declare function getRuntimeId (options: OptionalGlobalGetterOptions): PlatformaticGlobal['runtimeId'] | undefined
export declare function getRuntimeId (options: GlobalGetterOptions): PlatformaticGlobal['runtimeId'] | undefined
export declare function getNextVersion (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['nextVersion']
export declare function getNextVersion (options: OptionalGlobalGetterOptions): PlatformaticGlobal['nextVersion'] | undefined
export declare function getNextVersion (options: GlobalGetterOptions): PlatformaticGlobal['nextVersion'] | undefined
export declare function getExitOnUnhandledErrors (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['exitOnUnhandledErrors']
export declare function getExitOnUnhandledErrors (options: OptionalGlobalGetterOptions): PlatformaticGlobal['exitOnUnhandledErrors'] | undefined
export declare function getExitOnUnhandledErrors (options: GlobalGetterOptions): PlatformaticGlobal['exitOnUnhandledErrors'] | undefined
export declare function getReuseTcpPorts (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['reuseTcpPorts']
export declare function getReuseTcpPorts (options: OptionalGlobalGetterOptions): PlatformaticGlobal['reuseTcpPorts'] | undefined
export declare function getReuseTcpPorts (options: GlobalGetterOptions): PlatformaticGlobal['reuseTcpPorts'] | undefined
export declare function getHost (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['host']
export declare function getHost (options: OptionalGlobalGetterOptions): PlatformaticGlobal['host'] | undefined
export declare function getHost (options: GlobalGetterOptions): PlatformaticGlobal['host'] | undefined
export declare function getPort (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['port']
export declare function getPort (options: OptionalGlobalGetterOptions): PlatformaticGlobal['port'] | undefined
export declare function getPort (options: GlobalGetterOptions): PlatformaticGlobal['port'] | undefined
export declare function getAdditionalServerOptions (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['additionalServerOptions']
export declare function getAdditionalServerOptions (options: OptionalGlobalGetterOptions): PlatformaticGlobal['additionalServerOptions'] | undefined
export declare function getAdditionalServerOptions (options: GlobalGetterOptions): PlatformaticGlobal['additionalServerOptions'] | undefined
export declare function getTelemetryConfig (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['telemetryConfig']
export declare function getTelemetryConfig (options: OptionalGlobalGetterOptions): PlatformaticGlobal['telemetryConfig'] | undefined
export declare function getTelemetryConfig (options: GlobalGetterOptions): PlatformaticGlobal['telemetryConfig'] | undefined
export declare function getConfig (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['config']
export declare function getConfig (options: OptionalGlobalGetterOptions): PlatformaticGlobal['config'] | undefined
export declare function getConfig (options: GlobalGetterOptions): PlatformaticGlobal['config'] | undefined
export declare function getApplicationId (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['applicationId']
export declare function getApplicationId (options: OptionalGlobalGetterOptions): PlatformaticGlobal['applicationId'] | undefined
export declare function getApplicationId (options: GlobalGetterOptions): PlatformaticGlobal['applicationId'] | undefined
export declare function getWorkerId (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['workerId']
export declare function getWorkerId (options: OptionalGlobalGetterOptions): PlatformaticGlobal['workerId'] | undefined
export declare function getWorkerId (options: GlobalGetterOptions): PlatformaticGlobal['workerId'] | undefined
export declare function getRoot (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['root']
export declare function getRoot (options: OptionalGlobalGetterOptions): PlatformaticGlobal['root'] | undefined
export declare function getRoot (options: GlobalGetterOptions): PlatformaticGlobal['root'] | undefined
export declare function isEntrypoint (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['isEntrypoint']
export declare function isEntrypoint (options: OptionalGlobalGetterOptions): PlatformaticGlobal['isEntrypoint'] | undefined
export declare function isEntrypoint (options: GlobalGetterOptions): PlatformaticGlobal['isEntrypoint'] | undefined
export declare function getBasePath (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['basePath']
export declare function getBasePath (options: OptionalGlobalGetterOptions): PlatformaticGlobal['basePath'] | undefined
export declare function getBasePath (options: GlobalGetterOptions): PlatformaticGlobal['basePath'] | undefined
export declare function getRuntimeBasePath (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['runtimeBasePath']
export declare function getRuntimeBasePath (options: OptionalGlobalGetterOptions): PlatformaticGlobal['runtimeBasePath'] | undefined
export declare function getRuntimeBasePath (options: GlobalGetterOptions): PlatformaticGlobal['runtimeBasePath'] | undefined
export declare function getWantsAbsoluteUrls (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['wantsAbsoluteUrls']
export declare function getWantsAbsoluteUrls (options: OptionalGlobalGetterOptions): PlatformaticGlobal['wantsAbsoluteUrls'] | undefined
export declare function getWantsAbsoluteUrls (options: GlobalGetterOptions): PlatformaticGlobal['wantsAbsoluteUrls'] | undefined
export declare function getLogger (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['logger']
export declare function getLogger (options: OptionalGlobalGetterOptions): PlatformaticGlobal['logger'] | undefined
export declare function getLogger (options: GlobalGetterOptions): PlatformaticGlobal['logger'] | undefined
export declare function getLogLevel (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['logLevel']
export declare function getLogLevel (options: OptionalGlobalGetterOptions): PlatformaticGlobal['logLevel'] | undefined
export declare function getLogLevel (options: GlobalGetterOptions): PlatformaticGlobal['logLevel'] | undefined
export declare function getInterceptLogging (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['interceptLogging']
export declare function getInterceptLogging (options: OptionalGlobalGetterOptions): PlatformaticGlobal['interceptLogging'] | undefined
export declare function getInterceptLogging (options: GlobalGetterOptions): PlatformaticGlobal['interceptLogging'] | undefined
export declare function getPrometheus (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['prometheus']
export declare function getPrometheus (options: OptionalGlobalGetterOptions): PlatformaticGlobal['prometheus'] | undefined
export declare function getPrometheus (options: GlobalGetterOptions): PlatformaticGlobal['prometheus'] | undefined
export declare function getClientSpansAls (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['clientSpansAls']
export declare function getClientSpansAls (options: OptionalGlobalGetterOptions): PlatformaticGlobal['clientSpansAls'] | undefined
export declare function getClientSpansAls (options: GlobalGetterOptions): PlatformaticGlobal['clientSpansAls'] | undefined
export declare function getInterceptors (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['interceptors']
export declare function getInterceptors (options: OptionalGlobalGetterOptions): PlatformaticGlobal['interceptors'] | undefined
export declare function getInterceptors (options: GlobalGetterOptions): PlatformaticGlobal['interceptors'] | undefined
export declare function getValkeyClients (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['valkeyClients']
export declare function getValkeyClients (options: OptionalGlobalGetterOptions): PlatformaticGlobal['valkeyClients'] | undefined
export declare function getValkeyClients (options: GlobalGetterOptions): PlatformaticGlobal['valkeyClients'] | undefined
export declare function getOnHttpCacheRequest (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['onHttpCacheRequest']
export declare function getOnHttpCacheRequest (options: OptionalGlobalGetterOptions): PlatformaticGlobal['onHttpCacheRequest'] | undefined
export declare function getOnHttpCacheRequest (options: GlobalGetterOptions): PlatformaticGlobal['onHttpCacheRequest'] | undefined
export declare function getOnHttpCacheHit (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['onHttpCacheHit']
export declare function getOnHttpCacheHit (options: OptionalGlobalGetterOptions): PlatformaticGlobal['onHttpCacheHit'] | undefined
export declare function getOnHttpCacheHit (options: GlobalGetterOptions): PlatformaticGlobal['onHttpCacheHit'] | undefined
export declare function getOnHttpCacheMiss (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['onHttpCacheMiss']
export declare function getOnHttpCacheMiss (options: OptionalGlobalGetterOptions): PlatformaticGlobal['onHttpCacheMiss'] | undefined
export declare function getOnHttpCacheMiss (options: GlobalGetterOptions): PlatformaticGlobal['onHttpCacheMiss'] | undefined
export declare function getOnHttpStatsFree (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['onHttpStatsFree']
export declare function getOnHttpStatsFree (options: OptionalGlobalGetterOptions): PlatformaticGlobal['onHttpStatsFree'] | undefined
export declare function getOnHttpStatsFree (options: GlobalGetterOptions): PlatformaticGlobal['onHttpStatsFree'] | undefined
export declare function getOnHttpStatsConnected (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['onHttpStatsConnected']
export declare function getOnHttpStatsConnected (options: OptionalGlobalGetterOptions): PlatformaticGlobal['onHttpStatsConnected'] | undefined
export declare function getOnHttpStatsConnected (options: GlobalGetterOptions): PlatformaticGlobal['onHttpStatsConnected'] | undefined
export declare function getOnHttpStatsPending (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['onHttpStatsPending']
export declare function getOnHttpStatsPending (options: OptionalGlobalGetterOptions): PlatformaticGlobal['onHttpStatsPending'] | undefined
export declare function getOnHttpStatsPending (options: GlobalGetterOptions): PlatformaticGlobal['onHttpStatsPending'] | undefined
export declare function getOnHttpStatsQueued (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['onHttpStatsQueued']
export declare function getOnHttpStatsQueued (options: OptionalGlobalGetterOptions): PlatformaticGlobal['onHttpStatsQueued'] | undefined
export declare function getOnHttpStatsQueued (options: GlobalGetterOptions): PlatformaticGlobal['onHttpStatsQueued'] | undefined
export declare function getOnHttpStatsRunning (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['onHttpStatsRunning']
export declare function getOnHttpStatsRunning (options: OptionalGlobalGetterOptions): PlatformaticGlobal['onHttpStatsRunning'] | undefined
export declare function getOnHttpStatsRunning (options: GlobalGetterOptions): PlatformaticGlobal['onHttpStatsRunning'] | undefined
export declare function getOnHttpStatsSize (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['onHttpStatsSize']
export declare function getOnHttpStatsSize (options: OptionalGlobalGetterOptions): PlatformaticGlobal['onHttpStatsSize'] | undefined
export declare function getOnHttpStatsSize (options: GlobalGetterOptions): PlatformaticGlobal['onHttpStatsSize'] | undefined
export declare function getOnActiveResourcesEventLoop (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['onActiveResourcesEventLoop']
export declare function getOnActiveResourcesEventLoop (options: OptionalGlobalGetterOptions): PlatformaticGlobal['onActiveResourcesEventLoop'] | undefined
export declare function getOnActiveResourcesEventLoop (options: GlobalGetterOptions): PlatformaticGlobal['onActiveResourcesEventLoop'] | undefined
export declare function getInvalidateHttpCache (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['invalidateHttpCache']
export declare function getInvalidateHttpCache (options: OptionalGlobalGetterOptions): PlatformaticGlobal['invalidateHttpCache'] | undefined
export declare function getInvalidateHttpCache (options: GlobalGetterOptions): PlatformaticGlobal['invalidateHttpCache'] | undefined
export declare const setBasePath: PlatformaticGlobal['setBasePath']
export declare const setOpenapiSchema: PlatformaticGlobal['setOpenapiSchema']
export declare const setGraphqlSchema: PlatformaticGlobal['setGraphqlSchema']
export declare const setConnectionString: PlatformaticGlobal['setConnectionString']
export declare const setCustomHealthCheck: PlatformaticGlobal['setCustomHealthCheck']
export declare const setCustomReadinessCheck: PlatformaticGlobal['setCustomReadinessCheck']
export declare function getEvents (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['events']
export declare function getEvents (options: OptionalGlobalGetterOptions): PlatformaticGlobal['events'] | undefined
export declare function getEvents (options: GlobalGetterOptions): PlatformaticGlobal['events'] | undefined
export declare function getITC (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['itc']
export declare function getITC (options: OptionalGlobalGetterOptions): PlatformaticGlobal['itc'] | undefined
export declare function getITC (options: GlobalGetterOptions): PlatformaticGlobal['itc'] | undefined
export declare function getMessaging (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['messaging']
export declare function getMessaging (options: OptionalGlobalGetterOptions): PlatformaticGlobal['messaging'] | undefined
export declare function getMessaging (options: GlobalGetterOptions): PlatformaticGlobal['messaging'] | undefined
export declare function getCapability (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['capability']
export declare function getCapability (options: OptionalGlobalGetterOptions): PlatformaticGlobal['capability'] | undefined
export declare function getCapability (options: GlobalGetterOptions): PlatformaticGlobal['capability'] | undefined
export declare function getClosing (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['closing']
export declare function getClosing (options: OptionalGlobalGetterOptions): PlatformaticGlobal['closing'] | undefined
export declare function getClosing (options: GlobalGetterOptions): PlatformaticGlobal['closing'] | undefined
export declare function getSharedContext (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['sharedContext']
export declare function getSharedContext (options: OptionalGlobalGetterOptions): PlatformaticGlobal['sharedContext'] | undefined
export declare function getSharedContext (options: GlobalGetterOptions): PlatformaticGlobal['sharedContext'] | undefined
export declare function getManagement (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['management']
export declare function getManagement (options: OptionalGlobalGetterOptions): PlatformaticGlobal['management'] | undefined
export declare function getManagement (options: GlobalGetterOptions): PlatformaticGlobal['management'] | undefined
export declare function getSendHealthSignal (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['sendHealthSignal']
export declare function getSendHealthSignal (options: OptionalGlobalGetterOptions): PlatformaticGlobal['sendHealthSignal'] | undefined
export declare function getSendHealthSignal (options: GlobalGetterOptions): PlatformaticGlobal['sendHealthSignal'] | undefined
export declare function getTelemetryReady (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['telemetryReady']
export declare function getTelemetryReady (options: OptionalGlobalGetterOptions): PlatformaticGlobal['telemetryReady'] | undefined
export declare function getTelemetryReady (options: GlobalGetterOptions): PlatformaticGlobal['telemetryReady'] | undefined
export declare function getTracerProvider (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['tracerProvider']
export declare function getTracerProvider (options: OptionalGlobalGetterOptions): PlatformaticGlobal['tracerProvider'] | undefined
export declare function getTracerProvider (options: GlobalGetterOptions): PlatformaticGlobal['tracerProvider'] | undefined
export declare function getNotifyConfig (options?: RequiredGlobalGetterOptions): PlatformaticGlobal['notifyConfig']
export declare function getNotifyConfig (options: OptionalGlobalGetterOptions): PlatformaticGlobal['notifyConfig'] | undefined
export declare function getNotifyConfig (options: GlobalGetterOptions): PlatformaticGlobal['notifyConfig'] | undefined
export default getGlobal

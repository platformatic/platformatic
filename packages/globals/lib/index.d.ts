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
export declare function hasField (name: string): boolean
export declare function isBuilding (throwOnMissing?: true): PlatformaticGlobal['isBuilding']
export declare function isBuilding (throwOnMissing: false): PlatformaticGlobal['isBuilding'] | undefined
export declare function getExecutable (throwOnMissing?: true): PlatformaticGlobal['executable']
export declare function getExecutable (throwOnMissing: false): PlatformaticGlobal['executable'] | undefined
export declare function getRuntimeId (throwOnMissing?: true): PlatformaticGlobal['runtimeId']
export declare function getRuntimeId (throwOnMissing: false): PlatformaticGlobal['runtimeId'] | undefined
export declare function getNextVersion (throwOnMissing?: true): PlatformaticGlobal['nextVersion']
export declare function getNextVersion (throwOnMissing: false): PlatformaticGlobal['nextVersion'] | undefined
export declare function getExitOnUnhandledErrors (throwOnMissing?: true): PlatformaticGlobal['exitOnUnhandledErrors']
export declare function getExitOnUnhandledErrors (throwOnMissing: false): PlatformaticGlobal['exitOnUnhandledErrors'] | undefined
export declare function getReuseTcpPorts (throwOnMissing?: true): PlatformaticGlobal['reuseTcpPorts']
export declare function getReuseTcpPorts (throwOnMissing: false): PlatformaticGlobal['reuseTcpPorts'] | undefined
export declare function getHost (throwOnMissing?: true): PlatformaticGlobal['host']
export declare function getHost (throwOnMissing: false): PlatformaticGlobal['host'] | undefined
export declare function getPort (throwOnMissing?: true): PlatformaticGlobal['port']
export declare function getPort (throwOnMissing: false): PlatformaticGlobal['port'] | undefined
export declare function getAdditionalServerOptions (throwOnMissing?: true): PlatformaticGlobal['additionalServerOptions']
export declare function getAdditionalServerOptions (throwOnMissing: false): PlatformaticGlobal['additionalServerOptions'] | undefined
export declare function getTelemetryConfig (throwOnMissing?: true): PlatformaticGlobal['telemetryConfig']
export declare function getTelemetryConfig (throwOnMissing: false): PlatformaticGlobal['telemetryConfig'] | undefined
export declare function getConfig (throwOnMissing?: true): PlatformaticGlobal['config']
export declare function getConfig (throwOnMissing: false): PlatformaticGlobal['config'] | undefined
export declare function getApplicationId (throwOnMissing?: true): PlatformaticGlobal['applicationId']
export declare function getApplicationId (throwOnMissing: false): PlatformaticGlobal['applicationId'] | undefined
export declare function getWorkerId (throwOnMissing?: true): PlatformaticGlobal['workerId']
export declare function getWorkerId (throwOnMissing: false): PlatformaticGlobal['workerId'] | undefined
export declare function getRoot (throwOnMissing?: true): PlatformaticGlobal['root']
export declare function getRoot (throwOnMissing: false): PlatformaticGlobal['root'] | undefined
export declare function isEntrypoint (throwOnMissing?: true): PlatformaticGlobal['isEntrypoint']
export declare function isEntrypoint (throwOnMissing: false): PlatformaticGlobal['isEntrypoint'] | undefined
export declare function getBasePath (throwOnMissing?: true): PlatformaticGlobal['basePath']
export declare function getBasePath (throwOnMissing: false): PlatformaticGlobal['basePath'] | undefined
export declare function getRuntimeBasePath (throwOnMissing?: true): PlatformaticGlobal['runtimeBasePath']
export declare function getRuntimeBasePath (throwOnMissing: false): PlatformaticGlobal['runtimeBasePath'] | undefined
export declare function getWantsAbsoluteUrls (throwOnMissing?: true): PlatformaticGlobal['wantsAbsoluteUrls']
export declare function getWantsAbsoluteUrls (throwOnMissing: false): PlatformaticGlobal['wantsAbsoluteUrls'] | undefined
export declare function getLogger (throwOnMissing?: true): PlatformaticGlobal['logger']
export declare function getLogger (throwOnMissing: false): PlatformaticGlobal['logger'] | undefined
export declare function getLogLevel (throwOnMissing?: true): PlatformaticGlobal['logLevel']
export declare function getLogLevel (throwOnMissing: false): PlatformaticGlobal['logLevel'] | undefined
export declare function getInterceptLogging (throwOnMissing?: true): PlatformaticGlobal['interceptLogging']
export declare function getInterceptLogging (throwOnMissing: false): PlatformaticGlobal['interceptLogging'] | undefined
export declare function getPrometheus (throwOnMissing?: true): PlatformaticGlobal['prometheus']
export declare function getPrometheus (throwOnMissing: false): PlatformaticGlobal['prometheus'] | undefined
export declare function getClientSpansAls (throwOnMissing?: true): PlatformaticGlobal['clientSpansAls']
export declare function getClientSpansAls (throwOnMissing: false): PlatformaticGlobal['clientSpansAls'] | undefined
export declare function getInterceptors (throwOnMissing?: true): PlatformaticGlobal['interceptors']
export declare function getInterceptors (throwOnMissing: false): PlatformaticGlobal['interceptors'] | undefined
export declare function getValkeyClients (throwOnMissing?: true): PlatformaticGlobal['valkeyClients']
export declare function getValkeyClients (throwOnMissing: false): PlatformaticGlobal['valkeyClients'] | undefined
export declare function getOnHttpCacheRequest (throwOnMissing?: true): PlatformaticGlobal['onHttpCacheRequest']
export declare function getOnHttpCacheRequest (throwOnMissing: false): PlatformaticGlobal['onHttpCacheRequest'] | undefined
export declare function getOnHttpCacheHit (throwOnMissing?: true): PlatformaticGlobal['onHttpCacheHit']
export declare function getOnHttpCacheHit (throwOnMissing: false): PlatformaticGlobal['onHttpCacheHit'] | undefined
export declare function getOnHttpCacheMiss (throwOnMissing?: true): PlatformaticGlobal['onHttpCacheMiss']
export declare function getOnHttpCacheMiss (throwOnMissing: false): PlatformaticGlobal['onHttpCacheMiss'] | undefined
export declare function getOnHttpStatsFree (throwOnMissing?: true): PlatformaticGlobal['onHttpStatsFree']
export declare function getOnHttpStatsFree (throwOnMissing: false): PlatformaticGlobal['onHttpStatsFree'] | undefined
export declare function getOnHttpStatsConnected (throwOnMissing?: true): PlatformaticGlobal['onHttpStatsConnected']
export declare function getOnHttpStatsConnected (throwOnMissing: false): PlatformaticGlobal['onHttpStatsConnected'] | undefined
export declare function getOnHttpStatsPending (throwOnMissing?: true): PlatformaticGlobal['onHttpStatsPending']
export declare function getOnHttpStatsPending (throwOnMissing: false): PlatformaticGlobal['onHttpStatsPending'] | undefined
export declare function getOnHttpStatsQueued (throwOnMissing?: true): PlatformaticGlobal['onHttpStatsQueued']
export declare function getOnHttpStatsQueued (throwOnMissing: false): PlatformaticGlobal['onHttpStatsQueued'] | undefined
export declare function getOnHttpStatsRunning (throwOnMissing?: true): PlatformaticGlobal['onHttpStatsRunning']
export declare function getOnHttpStatsRunning (throwOnMissing: false): PlatformaticGlobal['onHttpStatsRunning'] | undefined
export declare function getOnHttpStatsSize (throwOnMissing?: true): PlatformaticGlobal['onHttpStatsSize']
export declare function getOnHttpStatsSize (throwOnMissing: false): PlatformaticGlobal['onHttpStatsSize'] | undefined
export declare function getOnActiveResourcesEventLoop (throwOnMissing?: true): PlatformaticGlobal['onActiveResourcesEventLoop']
export declare function getOnActiveResourcesEventLoop (throwOnMissing: false): PlatformaticGlobal['onActiveResourcesEventLoop'] | undefined
export declare function getInvalidateHttpCache (throwOnMissing?: true): PlatformaticGlobal['invalidateHttpCache']
export declare function getInvalidateHttpCache (throwOnMissing: false): PlatformaticGlobal['invalidateHttpCache'] | undefined
export declare const setBasePath: PlatformaticGlobal['setBasePath']
export declare const setOpenapiSchema: PlatformaticGlobal['setOpenapiSchema']
export declare const setGraphqlSchema: PlatformaticGlobal['setGraphqlSchema']
export declare const setConnectionString: PlatformaticGlobal['setConnectionString']
export declare const setCustomHealthCheck: PlatformaticGlobal['setCustomHealthCheck']
export declare const setCustomReadinessCheck: PlatformaticGlobal['setCustomReadinessCheck']
export declare function getEvents (throwOnMissing?: true): PlatformaticGlobal['events']
export declare function getEvents (throwOnMissing: false): PlatformaticGlobal['events'] | undefined
export declare function getITC (throwOnMissing?: true): PlatformaticGlobal['itc']
export declare function getITC (throwOnMissing: false): PlatformaticGlobal['itc'] | undefined
export declare function getMessaging (throwOnMissing?: true): PlatformaticGlobal['messaging']
export declare function getMessaging (throwOnMissing: false): PlatformaticGlobal['messaging'] | undefined
export declare function getCapability (throwOnMissing?: true): PlatformaticGlobal['capability']
export declare function getCapability (throwOnMissing: false): PlatformaticGlobal['capability'] | undefined
export declare function getClosing (throwOnMissing?: true): PlatformaticGlobal['closing']
export declare function getClosing (throwOnMissing: false): PlatformaticGlobal['closing'] | undefined
export declare function getSharedContext (throwOnMissing?: true): PlatformaticGlobal['sharedContext']
export declare function getSharedContext (throwOnMissing: false): PlatformaticGlobal['sharedContext'] | undefined
export declare function getManagement (throwOnMissing?: true): PlatformaticGlobal['management']
export declare function getManagement (throwOnMissing: false): PlatformaticGlobal['management'] | undefined
export declare function getSendHealthSignal (throwOnMissing?: true): PlatformaticGlobal['sendHealthSignal']
export declare function getSendHealthSignal (throwOnMissing: false): PlatformaticGlobal['sendHealthSignal'] | undefined
export declare function getTelemetryReady (throwOnMissing?: true): PlatformaticGlobal['telemetryReady']
export declare function getTelemetryReady (throwOnMissing: false): PlatformaticGlobal['telemetryReady'] | undefined
export declare function getTracerProvider (throwOnMissing?: true): PlatformaticGlobal['tracerProvider']
export declare function getTracerProvider (throwOnMissing: false): PlatformaticGlobal['tracerProvider'] | undefined
export declare function getNotifyConfig (throwOnMissing?: true): PlatformaticGlobal['notifyConfig']
export declare function getNotifyConfig (throwOnMissing: false): PlatformaticGlobal['notifyConfig'] | undefined
export default getGlobal

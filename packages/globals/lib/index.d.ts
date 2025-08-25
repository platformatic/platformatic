import { AsyncLocalStorage } from 'node:async_hooks'
import { type EventEmitter } from 'node:events'
import { type Level, type Logger } from 'pino'
import * as Client from 'prom-client'

type Optional<T> = T | undefined;

export type Handler = ((data: any) => any) | ((data: any) => Promise<any>)

export interface InvalidateHttpCacheOptions {
  keys?: string[]
  tags?: string[]
}

export interface PlatformaticGlobalInterface {
  events: EventEmitter

  // Runtime
  isBuilding: boolean
  executable: string

  // Service configuration
  host: string
  port: number
  config: object
  serviceId: string
  workerId: number | string
  root: string
  isEntrypoint: boolean
  basePath: string
  runtimeBasePath: string
  wantsAbsoluteUrls: boolean

  // Logging
  logger: Logger
  logLevel: Level
  interceptLogging: boolean

  // Metrics
  prometheus: {
    client: Client
    registry: Client.Registry
  }
  clientSpansAls: AsyncLocalStorage

  // Caching
  onHttpCacheHit(key: string): void
  onHttpCacheMiss(key: string): void
  invalidateHttpCache(options: InvalidateHttpCacheOptions): void

  // Setters
  setBasePath(path: string): void
  setOpenapiSchema(schema: object): void
  setGraphqlSchema(schema: object): void
  setConnectionString(connection: string): void
  setCustomHealthCheck(
    healthCheck: () =>
      | boolean
      | Promise<boolean>
      | { status: boolean; statusCode?: number; body?: string }
      | Promise<{ status: boolean; statusCode?: number; body?: string }>
  ): void
  setCustomReadinessCheck(
    readinessCheck: () =>
      | boolean
      | Promise<boolean>
      | { status: boolean; statusCode?: number; body?: string }
      | Promise<{ status: boolean; statusCode?: number; body?: string }>
  ): void

  // Messaging
  messaging: {
    send(name: string, message: any, options?: Record<string, any>): Promise<any>
    handle(message: Record<string, Handler>): void
    handle(message: string, handler: Handler): void
  }
}

export type PlatformaticGlobal = Optional<PlatformaticGlobalInterface>
export declare function getGlobal<T = {}>(): PlatformaticGlobal & T
export default getGlobal

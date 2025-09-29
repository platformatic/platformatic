import { AsyncLocalStorage } from 'node:async_hooks'
import { type EventEmitter } from 'node:events'
import { type Level, type Logger } from 'pino'
import * as Client from 'prom-client'

type Optional<T> = T | undefined

export type Handler = ((data: any) => any) | ((data: any) => Promise<any>)

export interface InvalidateHttpCacheOptions {
  keys?: string[]
  tags?: string[]
}

// This is purposely a copy of the one in @platformatic/itc to avoid the dependency
export interface ITC {
  send (message: string, data: any, options?: Record<string, any>): Promise<any>
  notify (message: string, data: any, options?: Record<string, any>): void
  handle (message: string, handler: Handler): void
  getHandler (message: string): Handler | undefined
  listen (): void
  close (): void
}

export interface MessagingApi {
  send (name: string, message: string, data: any): Promise<any>
  notify (name: string, message: string, data: any): void
  handle (message: string, handler: Handler): void
}

export interface PlatformaticGlobalInterface {
  // Runtime
  isBuilding: boolean
  executable: string

  // Service configuration
  host: string
  port: number
  config: object
  applicationId: string
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
  onHttpCacheHit (key: string): void
  onHttpCacheMiss (key: string): void
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

  events: EventEmitter & { emitAndNotify: EventEmitter['emit'] }
  itc: ITC
  messaging: MessagingApi
}

export type PlatformaticGlobal = Optional<PlatformaticGlobalInterface>
export declare function getGlobal<T = {}> (): PlatformaticGlobal & T
export default getGlobal

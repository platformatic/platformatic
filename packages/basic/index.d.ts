export interface StartOptions {
  listen?: boolean
}

export type BaseContext = Partial<{
  applicationId: string
  isEntrypoint: boolean
  isProduction: boolean
  isStandalone: boolean
  directory: string
  telemetryConfig: object
  metricsConfig: object
  serverConfig: object
  hasManagementApi: boolean
}>

export interface BaseOptions<Context = BaseContext> {
  context: Context
}

export declare const schemaOptions: Partial<Record<string, unknown>>

export class BaseCapability<Config = Record<string, any>, Options = BaseOptions> {
  basePath: string
  constructor (
    type: string,
    version: string,
    root: string,
    config: object,
    standardStreams?: Record<string, NodeJS.WritableStream>
  )

  init (): Promise<void>
  start (options: StartOptions): Promise<void>
  stop (): Promise<void>
  build (): Promise<void>
  getUrl (): string
  updateContext (context: Partial<BaseContext>): Promise<void>
  getConfig (includeMeta?: boolean): Promise<object>
  getInfo (): Promise<{ type: string; version: string }>
  getDispatchFunc (): Promise<Function>
  getDispatchTarget (): Promise<Function | string>
  getOpenapiSchema (): Promise<object>
  getGraphqlSchema (): Promise<string>
  setConnectionStatus (status: string): Promise<void>
  setOpenapiSchema (schema: object): Promise<void>
  setGraphqlSchema (schema: string): Promise<void>
  setCustomHealthCheck (
    healthCheck: () =>
      | boolean
      | Promise<boolean>
      | { status: boolean; statusCode?: number; body?: string }
      | Promise<{ status: boolean; statusCode?: number; body?: string }>
  ): Promise<void>
  setCustomReadinessCheck (
    readinessCheck: () =>
      | boolean
      | Promise<boolean>
      | { status: boolean; statusCode?: number; body?: string }
      | Promise<{ status: boolean; statusCode?: number; body?: string }>
  ): Promise<void>
  collectMetrics (): Promise<any>
  getMetrics ({ format: string }): Promise<string | Array<object>>
  getMeta (): Promise<object>
  inject (injectParams: string | object): Promise<{
    statusCode: number
    statusMessage: string
    headers: object
    body: object
  }>
  log (options: { message: string; level: string }): Promise<void>
  getWatchConfig (): Promise<{
    enabled: boolean
    path: string
    allow?: string[]
    ignore?: string[]
  }>

  _initializeLogger (options: object): Promise<void>
  _collectMetrics (): Promise<void>
}

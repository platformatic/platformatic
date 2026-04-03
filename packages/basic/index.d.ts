import type { ChildProcess } from 'node:child_process'

export interface StartOptions {
  listen?: boolean
}

type HealthCheckResult = {
  status: boolean
  statusCode?: number
  body?: string
}

type HealthCheck = () => boolean | Promise<boolean> | HealthCheckResult | Promise<HealthCheckResult>

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
  status: string
  type: string
  version: string
  root: string
  config: Config
  context: Options
  standardStreams: Record<string, NodeJS.WritableStream>
  applicationId?: string
  workerId: number
  telemetryConfig?: object
  serverConfig?: Record<string, unknown>
  openapiSchema: object | string | null
  graphqlSchema: unknown
  connectionString: string | null
  basePath: string | null
  isEntrypoint?: boolean
  isProduction?: boolean
  dependencies: string[]
  customHealthCheck: HealthCheck | null
  customReadinessCheck: HealthCheck | null
  clientWs: unknown
  runtimeConfig: object
  stdout: NodeJS.WritableStream
  stderr: NodeJS.WritableStream
  subprocessForceClose: boolean
  subprocessTerminationSignal: string
  logger: object
  metricsRegistry: object
  otlpBridge: object | null
  id?: string
  url?: string
  childManager: object | null
  subprocess?: ChildProcess
  subprocessConfig?: object
  reuseTcpPorts: boolean
  exitOnUnhandledErrors: boolean

  constructor (
    type: string,
    version: string,
    root: string,
    config: object,
    standardStreams?: Record<string, NodeJS.WritableStream>
  )
  constructor (
    type: string,
    version: string,
    root: string,
    config: object,
    context?: Options,
    standardStreams?: Record<string, NodeJS.WritableStream>
  )

  init (): Promise<void>
  start (options?: StartOptions): Promise<string | void>
  getDependencies (): string[]
  updateStatus (status: string): void
  updateMetricsConfig (metricsConfig: object): Promise<void>
  close (): Promise<void>
  stop (): Promise<void>
  build (): Promise<void>
  getUrl (): string
  waitForDependenciesStart (dependencies?: string[]): Promise<void | undefined>
  waitForDependentsStop (dependents?: string[]): Promise<void | undefined>
  updateContext (context: Partial<BaseContext>): Promise<void>
  getConfig (includeMeta?: boolean): Promise<object>
  getEnv (): Promise<object | undefined>
  getInfo (): Promise<{ type: string; version: string; dependencies: string[] }>
  getDispatchFunc (): this
  getDispatchTarget (): Promise<this | string>
  getOpenapiSchema (): Promise<object | null>
  getGraphqlSchema (): Promise<unknown>
  setConnectionString (connectionString: string | null): void
  setBasePath (basePath: string | null): void
  setOpenapiSchema (schema: object): void
  setGraphqlSchema (schema: unknown): void
  setCustomHealthCheck (healthCheck: HealthCheck): void
  setCustomReadinessCheck (readinessCheck: HealthCheck): void
  getCustomHealthCheck (): Promise<boolean | HealthCheckResult>
  getCustomReadinessCheck (): Promise<boolean | HealthCheckResult>
  getMetrics (options?: { format?: string }): Promise<string | Array<object>>
  getMeta (): Promise<object>
  buildWithCommand (
    command: string | string[],
    basePath?: string,
    opts?: {
      loader?: string | URL
      scripts?: unknown[]
      context?: object
      disableChildManager?: boolean
    }
  ): Promise<void>
  startWithCommand (command: string, loader?: string | URL, scripts?: unknown[]): Promise<void>
  stopCommand (): Promise<void>
  getChildManager (): object | null
  getChildManagerContext (basePath: string): Promise<object>
  setupChildManagerEventsForwarding (childManager: object): void
  inject (injectParams: string | object): Promise<{
    statusCode: number
    statusMessage: string
    headers: object
    body: object
  }>
  log (options: { message: string; level?: string }): void
  registerGlobals (globals: object): void
  verifyOutputDirectory (path: string): void
  getWatchConfig (): Promise<{
    enabled: boolean
    path: string
    allow?: string[]
    ignore?: string[]
  }>
  closing: boolean
  setClosing (): void

  notifyConfig (config: object): void
  spawn (command: string | string[]): Promise<ChildProcess>

  _initializeLogger (): object
  _collectMetrics (): Promise<void>
  _start (options?: StartOptions): void
  _stop (): Promise<void>
  _closeServer (server: object): Promise<void>
  _getEntrypointUrl (raw: string): string
}

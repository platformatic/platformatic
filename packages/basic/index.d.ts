import type { JSONSchemaType } from 'ajv'
import type { ChildProcess } from 'node:child_process'
import type { Server } from 'node:net'
import type { URL } from 'node:url'
import type { PlatformaticBasicConfig } from './config.d.ts'

export type { PlatformaticBasicConfig } from './config.d.ts'

export interface StartOptions {
  listen?: boolean | undefined
}

type HealthCheckResult = {
  status: boolean
  statusCode?: number
  body?: string
}

type HealthCheck = () => boolean | Promise<boolean> | HealthCheckResult | Promise<HealthCheckResult>

export type BaseContext = Partial<{
  applicationId: string
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

export declare const packageJson: Record<string, unknown>
export declare const schema: JSONSchemaType<PlatformaticBasicConfig>
export declare const schemaComponents: {
  application: JSONSchemaType<object>
  buildableApplication: JSONSchemaType<object>
  watch: JSONSchemaType<object>
}
export declare const version: string

export declare function findConfigurationFile (root: string, suffixes?: string | string[]): Promise<string>

export declare function resolve (
  fileOrDirectory: string,
  sourceOrConfig?: string | Record<string, unknown>,
  suffixes?: string | string[]
): Promise<{ root: string; source: string | Record<string, unknown> }>

export declare function transform<Config extends Record<string, any> | undefined> (config: Config): Promise<Config>

export declare const validationOptions: {
  useDefaults: true
  coerceTypes: true
  allErrors: true
  strict: false
}

export declare function create (
  fileOrDirectory: string,
  sourceOrConfig?: string | Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<unknown>

export declare function isImportFailedError (error: NodeJS.ErrnoException, pkg: string): boolean

export declare function importCapabilityPackage (directory: string, pkg: string): Promise<unknown>

export declare function importCapabilityAndConfig (
  root: string,
  config?: string | Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<{
  capability: unknown
  config: string | Record<string, unknown>
  autodetectDescription: string
  moduleName: string
}>

export declare namespace errors {
  export const ERROR_PREFIX: 'PLT_BASIC'
  export const exitCodes: {
    MANAGER_MESSAGE_HANDLING_FAILED: 11
    MANAGER_SOCKET_ERROR: 11
    PROCESS_UNHANDLED_ERROR: 20
    PROCESS_MESSAGE_HANDLING_FAILED: 21
    PROCESS_SOCKET_ERROR: 22
  }
  export function UnsupportedVersion (...args: any[]): Error
  export function NonZeroExitCode (...args: any[]): Error
}

export declare function getServerUrl (server: Server): string

export declare function buildListenOptions (serverConfig?: { port?: number | string; hostname?: string }): {
  port: number | string
  host?: string
}

export declare function buildAdditionalServerOptions (
  serverConfig?: Record<string, any>,
  skipHTTPSSanitization?: boolean
): Promise<Record<string, unknown>>

export declare function buildFastifyOptions (serverConfig?: Record<string, any>): Promise<Record<string, unknown>>

export declare function injectViaRequest (
  baseUrl: string | URL,
  injectParams: {
    method?: string
    url: string
    headers?: Record<string, string | string[] | undefined>
    body?: unknown
  },
  onInject?: (error: Error | null, response?: InjectViaRequestResponse) => unknown
): Promise<InjectViaRequestResponse | unknown | undefined>

export interface InjectViaRequestResponse {
  statusCode: number
  headers: Record<string, string | string[] | undefined>
  body: string
  payload: string
  rawPayload: Buffer
}

export declare function ensureFileUrl<PathOrUrl extends string | URL | undefined | null> (
  pathOrUrl: PathOrUrl
): PathOrUrl extends undefined | null ? PathOrUrl : string | URL

export declare function importFile (path: string | URL): Promise<unknown>
export declare function resolvePackageViaCJS (root: string, pkg: string): string
export declare function resolvePackageViaESM (root: string, pkg: string): Promise<string>
export declare function cleanBasePath (basePath?: string): string
export declare function ensureTrailingSlash (basePath?: string): string
export declare const resolvePackage: typeof resolvePackageViaCJS

export declare const isWindows: boolean
export declare function generateChildrenId (): string
export declare function getSocketPath (id: string): string

export class BaseCapability<Config = Record<string, any>, Options = BaseOptions> {
  status: string
  type: string
  version: string
  root: string
  config: Config
  context: Options
  applicationConfig: Record<string, unknown>
  standardStreams: Record<string, NodeJS.WritableStream>
  applicationId?: string
  workerId: number
  telemetryConfig?: object
  serverConfig?: Record<string, unknown>
  openapiSchema: object | string | null
  graphqlSchema: unknown
  connectionString: string | null
  basePath: string | null
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
  exitOnUnhandledErrors: boolean | number

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

export class ChildManager {
  constructor (opts: {
    loader?: string | URL
    context?: Record<string, any>
    scripts?: Array<string | URL>
    handlers?: Record<string, (...args: any[]) => unknown>
    [key: string]: unknown
  })

  listen (): Promise<void>
  close (): Promise<void>
  inject (): Promise<void>
  eject (): Promise<void>
  getSocketPath (): string
  getClients (): Set<unknown>
  register (): Promise<void>
  emit (...args: any[]): void
  send (client: unknown, name: string, message?: unknown): Promise<unknown>
  notify (client: unknown, name: string, message?: unknown): void

  _send (message: unknown, stringify?: boolean): void
  _setupListener (listener: (message: unknown) => void): void
  _createClosePromise (): Promise<unknown[]>
  _close (): void
}

export interface CancellablePromise<T> extends Promise<T> {
  cancel (): void
}

export declare function createServerListener (
  overridePort?: boolean | number,
  overrideHost?: boolean | string,
  additionalOptions?: Record<string, unknown>
): CancellablePromise<Server | null>

export declare function createChildProcessListener (): CancellablePromise<ChildProcess | null>

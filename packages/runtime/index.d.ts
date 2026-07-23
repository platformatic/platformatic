import { FastifyError } from '@fastify/error'
import { Configuration, ConfigurationOptions, logFatalError, parseArgs } from '@platformatic/foundation'
import { BaseGenerator } from '@platformatic/generators'
import { PlatformaticGlobal } from '@platformatic/globals'
import * as PromClient from '@platformatic/prom-client'
import { JSONSchemaType } from 'ajv'
import * as colorette from 'colorette'
import { EventEmitter } from 'node:events'
import { Logger } from 'pino'
import { PlatformaticRuntimeConfig } from './config.js'

export type RuntimeConfiguration = Promise<Configuration<PlatformaticRuntimeConfig>>

export type ApplicationCommandContext = {
  colorette: typeof colorette
  parseArgs: typeof parseArgs
  logFatalError: typeof logFatalError
}

export type ApplicationCommand = (
  logger: Logger,
  configuration: Configuration<unknown>,
  args: string[],
  context: ApplicationCommandContext
) => Promise<void>

export interface ApplicationsCommands {
  applications: Record<string, Configuration<unknown>>
  commands: Record<string, ApplicationCommand>
  help: Record<string, string | (() => string)>
}

export interface LoopbackMessagingOptions {
  logger?: Logger
  mount?: boolean
  runtimeConfig?: { messagingTimeout?: number; [key: string]: unknown }
}

export namespace errors {
  export const RuntimeExitedError: () => FastifyError
  export const UnknownRuntimeAPICommandError: (command: string) => FastifyError
  export const ApplicationNotFoundError: (id: string) => FastifyError
  export const ApplicationNotStartedError: (id: string) => FastifyError
  export const FailedToRetrieveOpenAPISchemaError: (id: string, error: string) => FastifyError
  export const ApplicationAlreadyStartedError: () => FastifyError
  export const RuntimeNotStartedError: () => FastifyError
  export const ConfigPathMustBeStringError: () => FastifyError
  export const NoConfigFileFoundError: (id: string) => FastifyError
  export const InvalidEntrypointError: (entrypoint: string) => FastifyError
  export const MissingEntrypointError: () => FastifyError
  export const MissingDependencyError: (dependency: string) => FastifyError
  export const InspectAndInspectBrkError: () => FastifyError
  export const InspectorPortError: () => FastifyError
  export const InspectorHostError: () => FastifyError
  export const CannotMapSpecifierToAbsolutePathError: (specifier: string) => FastifyError
  export const NodeInspectorFlagsNotSupportedError: () => FastifyError
  export const FailedToLoadExtensionError: (path: string, error: string) => FastifyError
  export const InvalidExtensionError: (path: string) => FastifyError
  export const ReservedITCHandlerNameError: (name: string) => FastifyError
  export const DuplicateITCHandlerNameError: (name: string) => FastifyError
  export const MetricFamilyCollisionError: (
    extension: string,
    metricFamily: string,
    otherSource: string
  ) => FastifyError
  export const DuplicateExtensionHealthCheckError: (kind: string, name: string, extension: string) => FastifyError
  export const DuplicateExtensionHealthRouteError: (
    extension: string,
    method: string,
    url: string,
    error: string
  ) => FastifyError
  export const ExtensionHealthRoutesUnavailableError: () => FastifyError
  export const LastProfileTimeoutError: (id: string) => FastifyError
}

export namespace symbols {
  export const kConfig: unique symbol
  export const kId: unique symbol
  export const kFullId: unique symbol
  export const kApplicationId: unique symbol
  export const kWorkerId: unique symbol
  export const kITC: unique symbol
  export const kHealthCheckTimer: unique symbol
  export const kHealthMetricsTimer: unique symbol
  export const kLastHealthCheckELU: unique symbol
  export const kLastWorkerScalerELU: unique symbol
  export const kWorkerStatus: unique symbol
  export const kWorkerHealthSignals: unique symbol
  export const kStderrMarker: string
  export const kWorkersBroadcast: unique symbol
}

export interface InjectParams {
  method?: string
  url: string
  headers?: Record<string, string>
  query?: Record<string, string>
  body?: unknown
}

export interface InjectResponse {
  statusCode: number
  statusMessage: string
  headers: Record<string, string>
  body: string
  payload: string
  rawPayload: ArrayBuffer
}

export interface ApplicationDetails {
  id: string
  type?: string
  config?: string
  path?: string
  status?: string
  dependencies?: string[]
  version?: string
  localUrl?: string
  entrypoint?: boolean
  sourceMaps?: boolean
  workers?: number
  url?: string | null
}

export interface ApplicationsTopology {
  entrypoint: string
  production: boolean
  applications: ApplicationDetails[]
}

export interface WorkerDetails {
  application: string
  worker: string
  status: string
  thread: number
  raw?: unknown
}

export interface SharedContextUpdateOptions {
  overwrite?: boolean
}

export interface RuntimeSharedContextUpdateOptions extends SharedContextUpdateOptions {
  context?: object
}

export interface RuntimeMetadata {
  pid: number
  cwd: string
  argv: string[]
  uptimeSeconds: number
  execPath: string
  nodeVersion: string
  projectDir: string
  packageName: string | null
  packageVersion: string | null
  url: string | null
  platformaticVersion: string
}

export declare class ManagementClient {
  constructor (allowedOperations?: string[])

  getRuntimeStatus (): Promise<string>
  getRuntimeMetadata (): Promise<RuntimeMetadata>
  getRuntimeConfig (): Promise<Record<string, unknown>>
  getRuntimeEnv (): Promise<Record<string, string>>
  getApplicationsIds (): Promise<string[]>
  getApplications (): Promise<ApplicationsTopology>
  getWorkers (): Promise<Record<string, WorkerDetails>>
  getApplicationDetails (id: string): Promise<ApplicationDetails>
  getApplicationConfig (id: string): Promise<Record<string, unknown>>
  getApplicationEnv (id: string): Promise<Record<string, string>>
  getApplicationOpenapiSchema (id: string): Promise<unknown>
  getApplicationGraphqlSchema (id: string): Promise<unknown>
  getMetrics (format?: string): Promise<{ metrics: unknown }>
  startApplication (id: string): Promise<void>
  stopApplication (id: string): Promise<void>
  restartApplication (id: string): Promise<void>
  restart (applications?: string[]): Promise<string>
  addApplications (applications: unknown[], start?: boolean): Promise<ApplicationDetails[]>
  removeApplications (ids: string[]): Promise<ApplicationDetails[]>
  inject (id: string, injectParams: InjectParams): Promise<InjectResponse>
}

export class Generator extends BaseGenerator {}

export class WrappedGenerator extends BaseGenerator {}

export declare const schema: JSONSchemaType<PlatformaticRuntimeConfig>

export interface RuntimeExtensionITC {
  handle (name: string, handler: (payload: any) => any): void
  send<Response = unknown> (target: string, name: string, payload?: unknown): Promise<Response>
  notify (target: string, name: string, payload?: unknown): Promise<void>
}

/**
 * Shared context facade exposed to main-thread runtime extensions.
 *
 * Mirrors the worker-side `sharedContext` API from `@platformatic/globals`:
 * - `get()` returns the current snapshot (a plain object). On the main thread
 *   this is always synchronous; the `Promise` variant exists for parity with
 *   workers where the first read may be asynchronous.
 * - `update(update, options?)` merges `update` into the current context by
 *   default. Pass `{ overwrite: true }` to replace it. Updates are broadcast
 *   to all running workers exactly like worker-originated updates.
 */
export interface RuntimeExtensionSharedContext {
  get (): object | Promise<object>
  update (update: object, options?: SharedContextUpdateOptions): Promise<void>
}

export interface RuntimeExtensionMetrics {
  client: typeof PromClient
  registry: PromClient.Registry
}

export type ExtensionHealthCheckResult =
  | boolean
  | {
    status: boolean
    statusCode?: number
    body?: string | object
  }

export type ExtensionHealthCheck = () => ExtensionHealthCheckResult | Promise<ExtensionHealthCheckResult>

export interface RuntimeExtensionHealth {
  /**
   * Registers a readiness check that participates in `/ready`.
   * Readiness-only failures do not fail `/status` (liveness).
   * Returns an unregister function.
   */
  registerReadinessCheck (name: string, check: ExtensionHealthCheck): () => void
  /**
   * Registers a liveness check that participates in `/status`.
   * Returns an unregister function.
   */
  registerLivenessCheck (name: string, check: ExtensionHealthCheck): () => void
  /**
   * Registers a Fastify plugin on the health probes server (shared with metrics
   * when they use the same address). Routes are registered before the server
   * starts listening. Returns an unregister function that disables the routes.
   */
  registerRoutes (plugin: (instance: any, opts: any) => unknown | Promise<unknown>): () => void
}

export interface RuntimeExtensionContext {
  runtime: Runtime
  itc: RuntimeExtensionITC
  logger: Logger
  options: Record<string, unknown>
  root: string
  sharedContext: RuntimeExtensionSharedContext
  /**
   * Per-extension Prometheus client and registry. Metrics registered here are
   * collected once by `Runtime.getMetrics()`, the management metrics API, and
   * the existing `/metrics` endpoint. Runtime does not invent a worker ID or
   * application ID for these main-thread metrics; only configured static
   * `metrics.labels` (excluding the application label name) are applied.
   */
  metrics: RuntimeExtensionMetrics
  health: RuntimeExtensionHealth
}

export interface RuntimeExtensionInstance {
  start?: () => void | Promise<void>
  stop?: () => void | Promise<void>
  close?: () => void | Promise<void>
}

export type RuntimeExtension = (
  context: RuntimeExtensionContext
) => void | RuntimeExtensionInstance | Promise<void | RuntimeExtensionInstance>

export declare class Runtime extends EventEmitter {
  init (): Promise<void>
  start (silent?: boolean): Promise<string | undefined>
  stop (silent?: boolean): Promise<void>
  close (silent?: boolean): Promise<void>
  restart (applications?: string[]): Promise<string | undefined>
  inject (id: string, injectParams: InjectParams): Promise<InjectResponse>
  getUrl (): string | undefined
  getRuntimeStatus (): string
  getRuntimeMetadata (): Promise<RuntimeMetadata>
  getRuntimeEnv (): Record<string, string>
  getRuntimeConfig (includeMeta?: boolean): Record<string, unknown>
  getApplicationsIds (): string[]
  /**
   * Returns topology for every configured application.
   * When `allowUnloaded` is `true`, applications without running workers are
   * reported as `{ id, status: 'stopped' }` instead of throwing.
   */
  getApplications (allowUnloaded?: boolean): Promise<ApplicationsTopology>
  getWorkers (includeRaw?: boolean): Promise<Record<string, WorkerDetails>>
  /**
   * Returns details for a single application.
   * When `allowUnloaded` is `true` and the application has no running workers,
   * returns `{ id, status: 'stopped' }` instead of throwing.
   */
  getApplicationDetails (id: string, allowUnloaded?: boolean): Promise<ApplicationDetails>
  /**
   * Returns the resolved configuration of an application worker.
   * When `ensureStarted` is `true` (default), throws `PLT_RUNTIME_APPLICATION_NOT_STARTED`
   * if the application is not running. When no worker exists for a known application,
   * throws `PLT_RUNTIME_WORKER_NOT_FOUND`. Unknown applications throw
   * `PLT_RUNTIME_APPLICATION_NOT_FOUND`.
   */
  getApplicationConfig (id: string, ensureStarted?: boolean): Promise<Record<string, unknown>>
  /**
   * Returns the effective environment of an application worker (`process.env`
   * merged with the capability env).
   * When `ensureStarted` is `true` (default), throws `PLT_RUNTIME_APPLICATION_NOT_STARTED`
   * if the application is not running. When no worker exists for a known application
   * (stopped/unloaded), throws `PLT_RUNTIME_WORKER_NOT_FOUND`. Unknown applications
   * throw `PLT_RUNTIME_APPLICATION_NOT_FOUND`.
   */
  getApplicationEnv (id: string, ensureStarted?: boolean): Promise<Record<string, string>>
  getApplicationOpenapiSchema (id: string): Promise<unknown>
  getApplicationGraphqlSchema (id: string): Promise<unknown>
  getMetrics (format?: string): Promise<{ metrics: unknown }>
  /**
   * Returns the current shared context. Synchronous on the main thread.
   * Do not mutate it in place — use `updateSharedContext()` so changes are
   * broadcast to workers.
   */
  getSharedContext (): object
  /**
   * Merges `options.context` into the shared context (or replaces it when
   * `options.overwrite` is `true`) and broadcasts the result to every running
   * worker. Returns the updated snapshot. Broadcast failures are logged and do
   * not reject the promise.
   */
  updateSharedContext (options?: RuntimeSharedContextUpdateOptions): Promise<object>
  startApplication (id: string, silent?: boolean): Promise<void>
  stopApplication (id: string, silent?: boolean): Promise<void>
  restartApplication (id: string): Promise<void>
  addApplications (applications: unknown[], start?: boolean): Promise<ApplicationDetails[]>
  removeApplications (applications: string[], silent?: boolean): Promise<ApplicationDetails[]>
  startApplicationProfiling (id: string, options?: Record<string, unknown>, ensureStarted?: boolean): Promise<void>
  stopApplicationProfiling (id: string, options?: Record<string, unknown>, ensureStarted?: boolean): Promise<Buffer>
  getApplicationLastProfile (id: string, options?: Record<string, unknown>, ensureStarted?: boolean): Promise<{ profile: Buffer, timestamp: number | null, preserved: boolean }>
}

export function wrapInRuntimeConfig (
  config: Configuration<unknown>,
  context?: ConfigurationOptions
): Promise<RuntimeConfiguration>

export declare const version: string

export declare function loadConfiguration (
  root: string | PlatformaticRuntimeConfig,
  source?: string | PlatformaticRuntimeConfig,
  context?: ConfigurationOptions
): Promise<RuntimeConfiguration>

export function create (
  root: string,
  source?: string | PlatformaticRuntimeConfig,
  context?: ConfigurationOptions
): Promise<Runtime>

export declare function prepareApplication (config: RuntimeConfiguration, application: object): object

export declare function transform (
  config: RuntimeConfiguration,
  schema?: object,
  context?: ConfigurationOptions
): Promise<RuntimeConfiguration>

export declare function loadApplicationsCommands (): Promise<ApplicationsCommands>

export declare function setupLoopbackMessaging (
  targetId: string,
  options?: LoopbackMessagingOptions
): PlatformaticGlobal['messaging'] & { unmount: () => void }

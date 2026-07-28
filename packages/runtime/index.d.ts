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

export type RuntimeConfiguration = Configuration<PlatformaticRuntimeConfig>

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
  export const SchedulerJobNotFoundError: (name: string) => FastifyError
  export const DuplicateSchedulerJobError: (name: string) => FastifyError
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

export interface SchedulerJobBase {
  name: string
  cron: string
  paused: boolean
  maxRetries: number
  lastExecutedAt?: string | null
  lastStatus?: 'success' | 'failed' | null
  nextRunAt?: string | null
}

export interface ConfiguredSchedulerJob extends SchedulerJobBase {
  source: 'config'
  callbackUrl: string
  method: string
  headers?: Record<string, string>
  body?: string | Record<string, unknown>
}

export interface ApplicationSchedulerJob extends SchedulerJobBase {
  source: 'application'
  applicationId: string
  scheduleId: string
  tasks: string[]
}

export type SchedulerJob = ConfiguredSchedulerJob | ApplicationSchedulerJob

export interface SchedulerRunResult {
  name: string
  success: boolean
  executedAt: string
}

export interface ApplicationSchedule {
  id: string
  cron: string
  tasks: string[]
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

export interface WorkerLifecycleEvent {
  application: string
  worker: number
  workersCount?: number
}

export interface ProfileCapturedEvent extends WorkerLifecycleEvent {
  id: string
  type: string
  timestamp: number
  sampleCount: number | null
}

export interface RuntimeHealthSignal {
  type: string
  max?: number
  mean?: number
  p99?: number
  timestamp?: number
  [key: string]: unknown
}

export interface HealthMetricsEvent extends WorkerLifecycleEvent {
  id: string
  currentHealth: object | null
  healthSignals: RuntimeHealthSignal[]
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
  getSchedulerJobs (): Promise<SchedulerJob[]>
  pauseSchedulerJob (name: string): Promise<SchedulerJob>
  resumeSchedulerJob (name: string): Promise<SchedulerJob>
  runSchedulerJob (name: string): Promise<SchedulerRunResult>
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
  // `includeMeta: true` returns the full merged Configuration object (which
  // carries the kMetadata symbol key: `{ root, path, env, module }`), not a
  // plain Record; the argument-invariant overload below covers every other
  // call.
  getRuntimeConfig (includeMeta: true): RuntimeConfiguration
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
  startApplicationProfiling (id: string, options: Record<string, unknown> & { allWorkers: true }, ensureStarted?: boolean): Promise<{ workers: number[] }>
  startApplicationProfiling (id: string, options?: Record<string, unknown>, ensureStarted?: boolean): Promise<void>
  stopApplicationProfiling (id: string, options: Record<string, unknown> & { allWorkers: true }, ensureStarted?: boolean): Promise<Array<{ workerIndex: number, profile: Buffer }>>
  stopApplicationProfiling (id: string, options: Record<string, unknown> & { includeSampleCount: true }, ensureStarted?: boolean): Promise<{ profile: Buffer, sampleCount: number }>
  stopApplicationProfiling (id: string, options?: Record<string, unknown>, ensureStarted?: boolean): Promise<Buffer>
  getApplicationLastProfile (id: string, options?: Record<string, unknown>, ensureStarted?: boolean): Promise<{ profile: Buffer, timestamp: number | null, sampleCount: number | null, preserved: boolean }>
  // Patches one application's resolved configuration through the same
  // per-application JSON-Patch mechanism the runtime already applies during
  // create()/start().
  setApplicationConfigPatch (applicationId: string, patch: Array<Record<string, unknown>>): void
  removeApplicationConfigPatch (applicationId: string): void

  // Typed worker lifecycle events. Catch-all overloads preserve EventEmitter's
  // open event surface so listeners for other runtime events still type-check.
  on (event: 'application:worker:started', listener: (event: WorkerLifecycleEvent) => void): this
  on (event: 'application:worker:exited', listener: (event: WorkerLifecycleEvent) => void): this
  on (event: 'application:worker:profile:captured', listener: (event: ProfileCapturedEvent) => void): this
  on (event: 'application:worker:health:metrics', listener: (event: HealthMetricsEvent) => void): this
  on (event: string | symbol, listener: (...args: any[]) => void): this

  off (event: 'application:worker:started', listener: (event: WorkerLifecycleEvent) => void): this
  off (event: 'application:worker:exited', listener: (event: WorkerLifecycleEvent) => void): this
  off (event: 'application:worker:profile:captured', listener: (event: ProfileCapturedEvent) => void): this
  off (event: 'application:worker:health:metrics', listener: (event: HealthMetricsEvent) => void): this
  off (event: string | symbol, listener: (...args: any[]) => void): this

  getSchedulerJobs (): SchedulerJob[]
  pauseSchedulerJob (name: string): Promise<SchedulerJob>
  resumeSchedulerJob (name: string): Promise<SchedulerJob>
  runSchedulerJob (name: string): Promise<SchedulerRunResult>
  getApplicationScheduledTasks (id: string): Promise<ApplicationSchedule[]>
  runApplicationScheduledTasks (id: string, scheduleId: string, scheduledTime: number): Promise<unknown>
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

// create() additionally accepts `setupSignals`, a Runtime-only option (it is
// never read outside this package) that controls whether SIGUSR2/close-with-grace
// handlers are installed.
export interface RuntimeCreateContext extends ConfigurationOptions<PlatformaticRuntimeConfig> {
  setupSignals?: boolean
}

export function create (
  root: string,
  source?: string | PlatformaticRuntimeConfig,
  context?: RuntimeCreateContext
): Promise<Runtime>

// The runtime's actual per-application preparation (worker defaults, paths,
// telemetry hooks, capability resolution) also takes the resolved worker
// count as a third argument, and is itself async.
export declare function prepareApplication (
  config: RuntimeConfiguration,
  application: object,
  workers?: PlatformaticRuntimeConfig['workers']
): Promise<object>

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

import { FastifyError } from '@fastify/error'
import { Configuration, ConfigurationOptions, logFatalError, parseArgs } from '@platformatic/foundation'
import { BaseGenerator } from '@platformatic/generators'
import { PlatformaticGlobal } from '@platformatic/globals'
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
  getApplications (): Promise<{ entrypoint: string; production: boolean; applications: ApplicationDetails[] }>
  getWorkers (): Promise<Record<string, unknown>>
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

export interface RuntimeExtensionContext {
  runtime: Runtime
  itc: RuntimeExtensionITC
  logger: Logger
  options: Record<string, unknown>
  root: string
}

export interface RuntimeExtensionInstance {
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
  getApplicationDetails (id: string, allowUnloaded?: boolean): Promise<ApplicationDetails>
  startApplication (id: string, silent?: boolean): Promise<void>
  stopApplication (id: string, silent?: boolean): Promise<void>
  restartApplication (id: string): Promise<void>
  addApplications (applications: unknown[], start?: boolean): Promise<ApplicationDetails[]>
  removeApplications (applications: string[], silent?: boolean): Promise<ApplicationDetails[]>
  startApplicationProfiling (id: string, options?: Record<string, unknown>, ensureStarted?: boolean): Promise<void>
  stopApplicationProfiling (id: string, options?: Record<string, unknown>, ensureStarted?: boolean): Promise<Buffer>
  getApplicationLastProfile (id: string, options?: Record<string, unknown>, ensureStarted?: boolean): Promise<{ profile: Buffer, timestamp: number | null }>
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

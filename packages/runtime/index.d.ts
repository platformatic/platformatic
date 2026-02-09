import { FastifyError } from '@fastify/error'
import { Configuration, ConfigurationOptions, logFatalError, parseArgs } from '@platformatic/foundation'
import { BaseGenerator } from '@platformatic/generators'
import { JSONSchemaType } from 'ajv'
import * as colorette from 'colorette'
import { Logger } from 'pino'
import { PlatformaticRuntimeConfig } from './config'

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

export module errors {
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
}

export module symbols {
  export declare const kConfig: unique symbol
  export declare const kId: unique symbol
  export declare const kFullId: unique symbol
  export declare const kApplicationId: unique symbol
  export declare const kWorkerId: unique symbol
  export declare const kITC: unique symbol
  export declare const kHealthCheckTimer: unique symbol
  export declare const kHealthMetricsTimer: unique symbol
  export declare const kLastHealthCheckELU: unique symbol
  export declare const kLastWorkerScalerELU: unique symbol
  export declare const kWorkerStatus: unique symbol
  export declare const kWorkerHealthSignals: unique symbol
  export declare const kStderrMarker: string
  export declare const kInterceptors: unique symbol
  export declare const kWorkersBroadcast: unique symbol
}

export class Generator extends BaseGenerator {}

export class WrappedGenerator extends BaseGenerator {}

export declare const schema: JSONSchemaType<PlatformaticRuntimeConfig>

export declare class Runtime {}

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

export declare function transform (config: RuntimeConfiguration): Promise<RuntimeConfiguration>

export declare function loadApplicationsCommands (): Promise<ApplicationsCommands>

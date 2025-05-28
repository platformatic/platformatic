import { FastifyError } from '@fastify/error'
import type { InstanceOptions } from 'ajv'
import type { FastifyPluginAsync } from 'fastify'

interface LogFn {
  // TODO: why is this different from `obj: object` or `obj: any`?
  /* tslint:disable:no-unnecessary-generics */
  <T extends object>(obj: T, msg?: string, ...args: any[]): void
  (obj: unknown, msg?: string, ...args: any[]): void
  (msg: string, ...args: any[]): void
}

export interface AbstractLogger {
  error: LogFn
  warn: LogFn
  info: LogFn
  debug: LogFn
  trace: LogFn
  child: (opts: object) => AbstractLogger
}

interface IEnv {
  [key: string]: string
}
export interface IConfigManagerOptions {
  source: string | JsonMap
  dirname?: string
  schema?: object
  fixPaths?: boolean
  schemaOptions?: Partial<InstanceOptions>
  env?: IEnv
  envWhitelist?: string[]
  watch?: boolean
  logger?: AbstractLogger
  allowToWatch?: string[]
  version?: string
  configVersion?: string
  disableEnvLoad?: boolean
  upgrade?: (config: any, version: string) => Promise<any> | any
}

type JsonArray = boolean[] | number[] | string[] | JsonMap[] | Date[]
type AnyJson = boolean | number | string | JsonMap | Date | JsonArray | JsonArray[]

interface JsonMap {
  [key: string]: AnyJson
}

interface ISerializer {
  parse(src: string): JsonMap
  stringify(obj: JsonMap): string
}

export class ConfigManager<T = object> {
  constructor(opts: IConfigManagerOptions)
  current: T
  currentRaw: T
  fullPath: string
  dirname: string
  getSerializer(): ISerializer
  replaceEnv(configString: string): string
  parse(): Promise<void>
  validate(): boolean
  toFastifyPlugin(): FastifyPluginAsync
  update(config: JsonMap): Promise<boolean | undefined>
  save(): Promise<boolean | undefined>
  load(): Promise<string>
}

export interface ConfigManagerConfig<T>
  extends Omit<IConfigManagerOptions, 'source' | 'watch' | 'schema' | 'configVersion'> {
  transformConfig: (this: ConfigManager<T>) => Promise<void>
  schema: object
}

export interface StartOptions {
  listen?: boolean
}

export interface StackableInfo {
  type: string
  version: string
}

export interface StackableDependency {
  id: string
  url?: string
  local: boolean
}

export interface StackableInterface {
  init?: () => Promise<void>
  start: (options: StartOptions) => Promise<void>
  stop: () => Promise<void>
  build: () => Promise<void>
  getUrl?: () => string
  updateContext?: (context: Partial<StackableContext>) => Promise<void>
  getConfig?: () => Promise<object>
  getInfo?: () => Promise<StackableInfo>
  getDispatchFunc?: () => Promise<Function>
  getDispatchTarget?: () => Promise<Function | string>
  getOpenapiSchema?: () => Promise<object>
  getGraphqlSchema?: () => Promise<string>
  setConnectionStatus?: (status: string) => Promise<void>
  setOpenapiSchema?: (schema: object) => Promise<void>
  setGraphqlSchema?: (schema: string) => Promise<void>
  setCustomHealthCheck?: (
    healthCheck: () =>
      | boolean
      | Promise<boolean>
      | { status: boolean; statusCode?: number; body?: string }
      | Promise<{ status: boolean; statusCode?: number; body?: string }>
  ) => Promise<void>
  setCustomReadinessCheck?: (
    readinessCheck: () =>
      | boolean
      | Promise<boolean>
      | { status: boolean; statusCode?: number; body?: string }
      | Promise<{ status: boolean; statusCode?: number; body?: string }>
  ) => Promise<void>
  collectMetrics?: () => Promise<any>
  getMetrics: ({ format: string }) => Promise<string | Array<object>>
  getMeta?(): () => Promise<object>
  inject?: (injectParams: object) => Promise<{
    statusCode: number
    statusMessage: string
    headers: object
    body: object
  }>
  log?: (options: { message: string; level: string }) => Promise<void>
  getBootstrapDependencies?: () => Promise<StackableDependency[]>
  getWatchConfig?: () => Promise<{
    enabled: boolean
    path: string
    allow?: string[]
    ignore?: string[]
  }>
}

export interface StackableContext {
  serviceId: string
  isEntrypoint: boolean
  isProduction: boolean
  directory: string
  telemetryConfig: object
  metricsConfig: object
  serverConfig: object
  hasManagementApi: boolean
  localServiceEnvVars: Map<string, string>
}

export interface BuildStackableArgs {
  config?: string
  onMissingEnv?: (envVarName: string) => string
}

export function buildStackable<ConfigType>(opts: { config: string }, app?: object): Promise<StackableInterface>

export interface Stackable<ConfigType> {
  configType: string
  configManagerConfig: ConfigManagerConfig<ConfigType>
  schema: object
  transformConfig?: (config: any) => Promise<any>
}

export default ConfigManager

/**
 * All the errors thrown by the plugin.
 */
export module errors {
  export const CannotFindEntityError: (entityName: string) => FastifyError

  export const ConfigurationDoesNotValidateAgainstSchemaError: FastifyError
  export const SourceMissingError: FastifyError
  export const InvalidPlaceholderError: (placeholder: string, suggestion: string) => FastifyError
  export const CannotParseConfigFileError: (error: string) => FastifyError
  export const ValidationErrors: (errors: string) => FastifyError
  export const AppMustBeAFunctionError: FastifyError
  export const SchemaMustBeDefinedError: FastifyError
  export const SchemaIdMustBeAStringError: FastifyError
  export const ConfigTypeMustBeAStringError: FastifyError
  export const AddAModulePropertyToTheConfigOrAddAKnownSchemaError: FastifyError
  export const VersionMismatchError: (currentVersion: string, requiredVersion: string) => FastifyError
  export const NoConfigFileFoundError: FastifyError
}

export function printConfigValidationErrors(err: any): void
export function printAndExitLoadConfigError(err: any): void
export function findConfigurationFile(
  root: string,
  configurationFile: string | null,
  schemas?: string | string[],
  typeOrCandidates?: boolean | string | string[]
): string | undefined
export function loadConfigurationFile(configurationFile: string): Promise<object>
export function saveConfigurationFile(configurationFile: string, config: object): Promise<void>

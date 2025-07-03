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
export interface IConfigManagerOptions<T> {
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
  transformConfig?: (this: ConfigManager<T>) => Promise<void>
  context?: object
}

type JsonArray = boolean[] | number[] | string[] | JsonMap[] | Date[]
type AnyJson = boolean | number | string | JsonMap | Date | JsonArray | JsonArray[]

interface JsonMap {
  [key: string]: AnyJson
}

interface ISerializer {
  parse (src: string): JsonMap
  stringify (obj: JsonMap): string
}

export class ConfigManager<T = object> {
  constructor (opts: IConfigManagerOptions<T>)
  current: T
  currentRaw: T
  fullPath: string
  dirname: string
  getSerializer (): ISerializer
  replaceEnv (configString: string): string
  parse (): Promise<void>
  validate (): boolean
  parseAndValidate (): Promise<void>
  toFastifyPlugin (): FastifyPluginAsync
  update (config: JsonMap): Promise<boolean | undefined>
  save (): Promise<boolean | undefined>
  load (): Promise<string>
}

export interface ConfigManagerConfig<T>
  extends Omit<IConfigManagerOptions<T>, 'source' | 'watch' | 'schema' | 'configVersion'> {
  transformConfig: (this: ConfigManager<T>) => Promise<void>
  schema: object
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

export function printConfigValidationErrors (err: any): void
export function printAndExitLoadConfigError (err: any): void
export function findConfigurationFile (
  root: string,
  configurationFile: string | null,
  schemas?: string | string[],
  typeOrCandidates?: boolean | string | string[]
): string | undefined
export function loadConfigurationFile (configurationFile: string): Promise<object>
export function saveConfigurationFile (configurationFile: string, config: object): Promise<void>

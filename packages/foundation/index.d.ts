import { FastifyError } from '@fastify/error'
import { JSONSchemaType } from 'ajv'
import { EventEmitter } from 'node:events'
import { Logger } from 'pino'

// Configuration types
export declare const kMetadata: unique symbol
export declare const envVariablePattern: RegExp
export declare const knownConfigurationFilesExtensions: string[]
export declare const knownConfigurationFilesSchemas: RegExp[]

export type RawConfiguration = Record<string, unknown>

export interface ValidationError {
  path: string
  message: string
}

export type ConfigurationOptions = Partial<{
  validate: boolean
  validationOptions: object
  transform: (config: RawConfiguration) => Promise<RawConfiguration> | RawConfiguration
  upgrade: (logger: Logger, config: RawConfiguration, version: string) => Promise<RawConfiguration> | RawConfiguration
  env: Record<string, string>
  ignoreProcessEnv: boolean
  replaceEnv: boolean
  replaceEnvIgnore: string[]
  onMissingEnv: (key: string) => string | undefined
  fixPaths: boolean
  logger: Logger
  root: string
  skipMetadata: boolean
}> &
  RawConfiguration

export interface ModuleWithVersion {
  module: string
  version?: string
}

export type Configuration<Config = {}> = Config & {
  [kMetadata]: {
    root: string
    path: string | null
    env: Record<string, string>
    module: { module: string; version: string } | null
  }
}

export declare function getParser (path: string): (raw: string, ...args: any[]) => any
export declare function getStringifier (path: string): (data: any) => string
export declare function stringifyJSON (data: any): string
export declare function stringifyJSON5 (data: any): string

export declare function printValidationErrors (err: { validation: Array<ValidationError> }): void
export declare function listRecognizedConfigurationFiles (
  suffixes?: string | string[] | null,
  extensions?: string | string[]
): string[]
export declare function extractModuleFromSchemaUrl (
  config: RawConfiguration | ModuleWithVersion,
  throwOnMissing?: boolean
): ModuleWithVersion | null
export declare function findConfigurationFile (
  root: string,
  suffixes?: string | string[],
  extensions?: string | string[],
  candidates?: string[]
): Promise<string | null>
export declare function findConfigurationFileRecursive (
  root: string,
  configurationFile?: string,
  schemas?: string | string[],
  suffixes?: string | string[]
): Promise<string | null>
export declare function findRuntimeConfigurationFile (
  logger: Logger,
  root: string,
  configurationFile: string,
  fallback?: boolean,
  throwOnError?: boolean,
  verifyPackages?: boolean
): Promise<string | null>
export declare function loadConfigurationFile (configurationFile: string): Promise<RawConfiguration>
export declare function saveConfigurationFile (configurationFile: string, config: RawConfiguration): Promise<void>
export declare function createValidator (
  schema: JSONSchemaType<any>,
  validationOptions?: object,
  context?: ConfigurationOptions
): (data: any) => boolean
export declare function loadEnv (root: string): Promise<Record<string, string>>
export declare function replaceEnv (
  config: RawConfiguration,
  env: Record<string, string>,
  onMissingEnv?: (key: string) => string | undefined,
  ignore?: string[]
): RawConfiguration
export declare function loadConfiguration (
  source: string | RawConfiguration,
  schema?: any,
  options?: ConfigurationOptions
): Promise<Configuration>
export declare function loadConfigurationModule (root: string, config: RawConfiguration | ModuleWithVersion): any

// Error types
export declare const ERROR_PREFIX: string
export declare function ensureLoggableError (error: Error): Error

export declare const PathOptionRequiredError: FastifyError
export declare const NoConfigFileFoundError: FastifyError
export declare const InvalidConfigFileExtensionError: FastifyError
export declare const AddAModulePropertyToTheConfigOrAddAKnownSchemaError: FastifyError
export declare const CannotParseConfigFileError: FastifyError
export declare const SourceMissingError: FastifyError
export declare const RootMissingError: FastifyError
export declare const SchemaMustBeDefinedError: FastifyError
export declare const ConfigurationDoesNotValidateAgainstSchemaError: FastifyError

// Execution types
export declare const kTimeout: unique symbol
export declare function executeWithTimeout<T> (promise: Promise<T>, timeout: number, timeoutValue?: any): Promise<T>

// File system types
export declare function removeDotSlash (path: string): string
export declare function generateDashedName (): string
export declare function isFileAccessible (filename: string, directory?: string): Promise<boolean>
export declare function createDirectory (path: string, empty?: boolean): Promise<string | undefined>
export declare function createTemporaryDirectory (prefix: string): Promise<string>
export declare function safeRemove (path: string): Promise<void>
export declare function searchFilesWithExtensions (
  root: string,
  extensions: string | string[],
  globOptions?: object
): Promise<string[]>
export declare function searchJavascriptFiles (projectDir: string, globOptions?: object): Promise<string[]>
export declare function hasFilesWithExtensions (
  root: string,
  extensions: string | string[],
  globOptions?: object
): Promise<boolean>
export declare function hasJavascriptFiles (projectDir: string, globOptions?: object): Promise<boolean>

export interface FileWatcherOptions {
  path: string
  allowToWatch?: string[]
  watchIgnore?: string[]
}

export declare class FileWatcher extends EventEmitter {
  constructor (opts: FileWatcherOptions)
  path: string
  allowToWatch: string[] | null
  watchIgnore: string[] | null
  isWatching: boolean
  startWatching (): void
  stopWatching (): Promise<void>
  shouldFileBeWatched (fileName: string): boolean
  isFileAllowed (fileName: string): boolean
  isFileIgnored (fileName: string): boolean
}

// Logger types
export declare function setPinoFormatters (options: any): void
export declare function buildPinoFormatters (formatters: { path: string }): object
export declare function setPinoTimestamp (options: any): void
export declare function buildPinoTimestamp (timestamp: string): Function
export declare function buildPinoOptions (
  loggerConfig: any,
  serverConfig: any,
  serviceId?: string,
  workerId?: string,
  context?: any,
  root?: string
): object
export declare function loadFormatters (require: NodeRequire, file: string): any
export declare function disablePinoDirectWrite (): void
export declare function noop (): void

export declare const abstractLogger: Logger
export declare const stdTimeFunctions: {
  epochTime: Function
  unixTime: Function
  nullTime: Function
  isoTime: Function
}

// Module types
export declare const kFailedImport: unique symbol
export declare const defaultPackageManager: string

export declare function getLatestNpmVersion (pkg: string): Promise<string | null>
export declare function getPkgManager (): string
export declare function getPackageManager (root: string, defaultManager?: string, search?: boolean): Promise<string>
export declare function getPlatformaticVersion (): Promise<string>
export declare function hasDependency (packageJson: any, dependency: string): any
export declare function splitModuleFromVersion (module: string): { module?: string; version?: string }
export declare function detectApplicationType (
  root: string,
  packageJson?: any
): Promise<{ name: string; label: string } | null>
export declare function loadModule (require: NodeRequire, path: string): Promise<any>

// Node types
export declare function checkNodeVersionForServices (): void
export declare const features: {
  node: {
    reusePort: boolean
    worker: {
      getHeapStatistics: boolean
    }
  }
}

// Object types
export declare const deepmerge: (target: any, source: any) => any
export declare function isKeyEnabled (key: string, config: any): boolean
export declare function getPrivateSymbol (obj: any, name: string): symbol | undefined

// Schema types
export declare function overridableValue (spec: any, defaultValue?: any): any
export declare function removeDefaults (schema: any): any
export declare function omitProperties (obj: any, properties: string | string[]): any

export declare const env: JSONSchemaType<Record<string, string>>
export declare const workers: JSONSchemaType<number | string>
export declare const preload: JSONSchemaType<string | string[]>
export declare const watch: JSONSchemaType<object>
export declare const cors: JSONSchemaType<object>
export declare const logger: JSONSchemaType<object>
export declare const server: JSONSchemaType<object>
export declare const fastifyServer: JSONSchemaType<object>
export declare const undiciInterceptor: JSONSchemaType<object>
export declare const health: JSONSchemaType<object>
export declare const healthWithoutDefaults: JSONSchemaType<object>
export declare const telemetryExporter: JSONSchemaType<object>
export declare const telemetry: JSONSchemaType<object>
export declare const services: JSONSchemaType<object[]>
export declare const runtimeUnwrappablePropertiesList: string[]
export declare const runtimeProperties: JSONSchemaType<object>
export declare const wrappedRuntimeProperties: JSONSchemaType<object>
export declare const wrappedRuntime: JSONSchemaType<object>
export declare const schemaComponents: Record<string, JSONSchemaType<any>>

// String types
export declare function findNearestString (strings: string[], target: string): string | null
export declare function match (actual: any, expected: any): boolean
export declare function escapeRegexp (raw: string): string
export declare function parseMemorySize (size: string): number

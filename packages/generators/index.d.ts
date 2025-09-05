import { BaseLogger } from 'pino'

export type EnvVarValue = string | number | boolean

export type Env = {
  [key: string]: EnvVarValue
}

export type KeyValue = {
  [key: string]: string | number | undefined | null | boolean | object
}

export type JSONValue = string | number | boolean | { [x: string]: JSONValue } | object | Array<JSONValue>

export type Dependency = {
  [key: string]: string
}

export type WhereClause = {
  before?: string
  after?: string
}

export type GeneratorMetadata = {
  targetDirectory: string
  env: KeyValue
}

export type ConfigFieldDefinition = {
  label: string
  var: string
  default: string
  type: 'number' | 'string' | 'boolean' | 'path'
  configValue?: string
}

export type ConfigField = {
  var: string
  configValue?: string
  value: string
}

export type AddEnvVarOptions = {
  overwrite: boolean
}

export type PackageConfiguration = {
  type: 'number' | 'string' | 'boolean' | 'path'
  path: string
  value: number | string | boolean
}

export type PackageDefinition = {
  name: string
  options: PackageConfiguration
}

export declare function stripVersion (version: string): string
export declare function convertApplicationNameToPrefix (applicationName: string): string
export declare function addPrefixToServiceName (applicationName: string, prefix: string): string
export declare function envObjectToString (env: Env): string
export declare function envStringToObject (env: string): Env
export declare function extractEnvVariablesFromText (text: string): string[]
export declare function getPackageConfigurationObject (config: PackageConfiguration[]): object
export declare function flattenObject (obj: object): object
export declare function getApplicationTemplateFromSchemaUrl (schemaUrl: string): string
export declare const PLT_ROOT: string

export type FileGeneratorOptions = {
  logger?: BaseLogger
}

export type FileObject = {
  path: string
  file: string
  contents: string
}

export class FileGenerator {
  files: FileObject[]
  targetDirectory: string

  constructor (opts?: FileGeneratorOptions)

  setTargetDirectory (dir: string): void
  addFile (file: FileObject): void
  appendfile (file: FileObject): void
  reset (): void
  writeFiles (): Promise<void>
  listFiles (): FileObject
  loadFile (): Promise<FileObject>
  getFileObject (file: string, path?: string): FileObject
}

export type BaseGeneratorOptions = FileGeneratorOptions & {
  module: string
  inquirer?: object
}

export type BaseGeneratorConfig = Record<string, any> & {
  port?: number
  hostname?: string
  plugin?: boolean
  dependencies?: Dependency
  devDependencies?: Dependency
  typescript?: boolean
  initGitRepository?: boolean
  env?: KeyValue
  isRuntimeContext?: boolean
  applicationName?: string
  envPrefix?: string
}

export class BaseGenerator extends FileGenerator {
  logger: BaseLogger
  platformaticVersion: string
  fastifyVersion: string

  config: BaseGeneratorConfig
  questions: Array<object>

  packages: PackageConfiguration[]
  constructor (opts?: BaseGeneratorOptions)

  setConfig (config?: BaseGeneratorConfig): void

  getEnvVarName (envVarName: string): string
  addEnvVars (envVars: Env, opts: AddEnvVarOptions): void
  addEnvVar (envVarName: string, envVarValue: EnvVarValue, opts: AddEnvVarOptions): void
  getEnvVar (envVarName: string): EnvVarValue
  setEnvVars (env?: Env): void

  getDefaultConfig (): { [x: string]: JSONValue }

  getFastifyVersion (): Promise<string>
  getPlatformaticVersion (): Promise<string>

  addPackage (pkg: PackageDefinition): Promise<void>

  loadFromDir (dir: string): Promise<void>
  prepare (): Promise<GeneratorMetadata>
  run (): Promise<GeneratorMetadata>
  addQuestion (question: any, where?: WhereClause): Promise<void>
  removeQuestion (variableName: string): void
  getTSConfig (): { [x: string]: JSONValue }

  getConfigFieldsDefinitions (): ConfigFieldDefinition[]
  setConfigFields (fields: ConfigField[]): void

  generateConfigFile (): Promise<void>
  readPackageJsonFile (): Promise<JSONValue>
  generatePackageJson (): Promise<{ [x: string]: JSONValue }>
  getConfigFileName (): string
  checkEnvVariablesInConfigFile (): boolean
  _beforePrepare (): Promise<void>
  _afterPrepare (): Promise<void | JSONValue>
  _getConfigFileContents (): Promise<{ [x: string]: JSONValue }>

  postInstallActions (): Promise<void>
}

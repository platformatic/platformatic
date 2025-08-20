import { BaseLogger } from 'pino'
import { FileGenerator } from './file-generator'
import { PackageConfiguration } from './utils'
export namespace BaseGenerator {
  export type BaseGeneratorOptions = FileGenerator.FileGeneratorOptions & {
    module: string
    inquirer?: object
  }

  export type EnvVarValue = string | number | boolean
  export type Env = {
    [key: string]: EnvVarValue
  }
  type KeyValue = {
    [key: string]: string | number | undefined | null | boolean | object
  }
  type JSONValue =
    | string
    | number
    | boolean
    | { [x: string]: JSONValue }
    | object
    | Array<JSONValue>

  type Dependency = {
    [key: string]: string
  }

  type PackageDefinition = {
    name: string,
    options: PackageConfiguration
  }
  type BaseGeneratorConfig = Record<string, any> & {
    port?: number
    hostname?: string
    plugin?: boolean
    dependencies?: Dependency
    devDependencies?: Dependency
    typescript?: boolean
    initGitRepository?: boolean
    env?: KeyValue,
    isRuntimeContext?: boolean,
    applicationName?: string,
    envPrefix?: string
  }

  type WhereClause = {
    before?: string
    after?: string
  }

  type GeneratorMetadata = {
    targetDirectory: string
    env: KeyValue
  }

  type ConfigFieldDefinition = {
    label: string
    var: string
    default: string
    type: 'number' | 'string' | 'boolean' | 'path'
    configValue?: string
  }

  type ConfigField = {
    var: string
    configValue?: string
    value: string
  }

  type AddEnvVarOptions = {
    overwrite: boolean
  }

  export class BaseGenerator extends FileGenerator.FileGenerator {
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
    _getConfigFileContents (): Promise<{ [x: string]: BaseGenerator.JSONValue }>

    postInstallActions (): Promise<void>
  }
}

import { BaseLogger } from 'pino'
import { FileGenerator } from './file-generator'

export namespace BaseGenerator {
  export type BaseGeneratorOptions = FileGenerator.FileGeneratorOptions & {
    module: string
    inquirer?: object
  }
  
  export type Env = {
    [key: string]: string | number | boolean
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
  type BaseGeneratorConfig = Record<string, any> & {
    port?: number
    hostname?: string
    plugin?: boolean
    dependencies?: Dependency
    devDependencies?: Dependency  
    typescript?: boolean
    initGitRepository?: boolean
    staticWorkspaceGitHubActions?: boolean
    dynamicWorkspaceGitHubActions?: boolean
    env?: KeyValue,
    isRuntimeContext?: boolean,
    serviceName?: string,
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
  export class BaseGenerator extends FileGenerator.FileGenerator {
    logger: BaseLogger
    platformaticVersion: string
    fastifyVersion: string
    
    config: BaseGeneratorConfig
    questions: Array<object>
  
    constructor(opts?: BaseGeneratorOptions)
  
    setConfig(config?: BaseGeneratorConfig): void
    setEnv(env?: Env ): void
  
    getDefaultConfig(): JSONValue
    getDefaultEnv(): Env 
  
    getFastifyVersion(): Promise<string>
    getPlatformaticVersion(): Promise<string>
  
    prepare(): Promise<GeneratorMetadata>
    run(): Promise<GeneratorMetadata>
    addQuestion(question: any, where?: WhereClause): Promise<void>
    removeQuestion(variableName: string): void
    getTSConfig(): JSONValue
    
    generateConfigFile(): Promise<void>
    readPackageJsonFile(): Promise<JSONValue>
    generatePackageJson(): Promise<JSONValue>
    getConfigFileName(): string
    checkEnvVariablesInConfigFile(): boolean
    _beforePrepare(): Promise<void>
    _afterPrepare(): Promise<void | JSONValue>
    _getConfigFileContents(): Promise<JSONValue>
    _generateEnv(): Promise<void>
    appendConfigEnv(): Promise<void>
  }
}

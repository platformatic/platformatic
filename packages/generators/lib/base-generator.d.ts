'use strict'

import { BaseLogger } from 'pino'
import { FileGenerator } from './file-generator'
import type FileGeneratorOptions from './file-generator'
import { Answers, PromptModule } from 'inquirer'

export type BaseGeneratorOptions = FileGeneratorOptions & {
  type?: 'service' | 'db' | 'composer'
  inquirer?: PromptModule
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
class BaseGenerator extends FileGenerator {
  logger: BaseLogger
  platformaticVersion: string
  fastifyVersion: string
  answers: Answers
  config: BaseGeneratorConfig
  questions: Array

  constructor(opts?: BaseGeneratorOptions)

  setConfig(config?: BaseGeneratorConfig): void
  setEnv(env?: Env ): void

  getDefaultConfig(): JSONValue
  getDefaultEnv(): Env 

  async getFastifyVersion(): string
  async getPlatformaticVersion(): string

  async prepare(): Promise<GeneratorMetadata>
  async run(): Promise<GeneratorMetadata>
  async addQuestion(question: any, where?: WhereClause)
  removeQuestion(variableName: string)
  getTSConfig(): JSONValue
  
  async generateConfigFile(): Promise<void>
  async readPackageJsonFile(): Promise<JSONValue>
  async generatePackageJson(): Promise<JSONValue>
  getConfigFileName(): string
  checkEnvVariablesInConfigFile(): boolean
  async _beforePrepare(): Promise<void>
  async _afterPrepare(): Promise<void | JSONValue>
  async _getConfigFileContents(): Promise<JSONValue>
  async _generateEnv(): Promise<void>
  async appendConfigEnv(): Promise<void>
}

export { BaseGenerator }
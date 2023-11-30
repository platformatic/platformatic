'use strict'

import { BaseGenerator, BaseGeneratorOptions } from "@platformatic/generators"
import { FileGenerator } from "@platformatic/generators/lib/file-generator"

type Service = {
  config: FileGenerator | BaseGenerator
}
type GeneratorMetadata = {
  targetDirectory: string
  env: KeyValue
}

type KeyValue = {
  [key: string]: string
}

type RuntimeGeneratorOptions =  BaseGeneratorOptions & {
  logLevel: string
}

class RuntimeGenerator extends BaseGenerator {
  services: Service[]
  entryPoint: Service
  constructor(opts?: Omit<RuntimeGeneratorOptions, 'module'>)

  async addService(service: Service, name: string): Promise<void>

  setEntryPoint(entryPoint: string): void

  setServicesDirectory(): void

  setServicesConfig(configToOverride: object): void

  getRuntimeEnv(): KeyValue
  async writeServicesFiles(): Promise<GeneratorMetadata>
}

export default RuntimeGenerator
export { RuntimeGenerator }

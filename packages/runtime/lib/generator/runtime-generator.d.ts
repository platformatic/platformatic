import { BaseGenerator } from "@platformatic/generators"
import { FileGenerator } from "@platformatic/generators/lib/file-generator"

type Service = {
  config: FileGenerator.FileGenerator | BaseGenerator.BaseGenerator
}
type GeneratorMetadata = {
  targetDirectory: string
  env: KeyValue
}

type KeyValue = {
  [key: string]: string
}

type RuntimeGeneratorOptions =  BaseGenerator.BaseGeneratorOptions & {
  logLevel: string
}

export namespace RuntimeGenerator {
  export class RuntimeGenerator extends BaseGenerator.BaseGenerator {
    services: Service[]
    entryPoint: Service
    constructor(opts?: RuntimeGeneratorOptions)
  
    addService(service: Service, name: string): Promise<void>
  
    setEntryPoint(entryPoint: string): void
  
    setServicesDirectory(): void
  
    setServicesConfig(configToOverride: object): void
  
    getRuntimeEnv(): KeyValue
    writeServicesFiles(): Promise<GeneratorMetadata>
  }
}

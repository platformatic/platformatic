import { BaseGenerator } from '@platformatic/generators'
import { RuntimeGenerator } from "../../../runtime/lib/generator/runtime-generator";

interface KeyValue {
  [key: string]: string
}

export namespace ServiceGenerator {
  export class ServiceGenerator extends BaseGenerator.BaseGenerator {
    runtime: RuntimeGenerator.RuntimeGenerator

    setRuntime(runtime: RuntimeGenerator.RuntimeGenerator): void
    constructor (opts?: Omit<BaseGenerator.BaseGeneratorOptions, 'module'>)

  }
}

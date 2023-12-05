import { BaseGenerator } from '@platformatic/generators'

interface KeyValue {
  [key: string]: string
}

export namespace ServiceGenerator {
  export class ServiceGenerator extends BaseGenerator.BaseGenerator {
    constructor (opts?: Omit<BaseGenerator.BaseGeneratorOptions, 'module'>)
  }
}

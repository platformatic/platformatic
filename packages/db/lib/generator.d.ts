import { BaseGenerator, BaseGeneratorOptions } from '@platformatic/generators'

type DBGeneratorOptions = BaseGeneratorOptions
export class DBGenerator extends BaseGenerator {
  connectionStrings: string[]
  constructor(opts?: DBGeneratorOptions)
}

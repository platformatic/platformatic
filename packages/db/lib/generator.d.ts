import { BaseGenerator } from '@platformatic/generators'

type DBGeneratorOptions = BaseGenerator.BaseGeneratorOptions
export class DBGenerator extends BaseGenerator.BaseGenerator {
  connectionStrings: string[]
  constructor (opts?: DBGeneratorOptions)
}

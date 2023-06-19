import { type InstanceOptions } from 'ajv' 
import { type FastifyPluginAsync } from 'fastify'
interface IEnv {
  [key: string]: string 
}
interface IConfigManagerOptions {
  source: string | JsonMap
  schema?: object
  schemaOptions?: InstanceOptions
  env?: IEnv
  envWhitelist?: string[]
  watch?: boolean
  allowToWatch?: string[]
}

type JsonArray = boolean[] | number[] | string[] | JsonMap[] | Date[]
type AnyJson = boolean | number | string | JsonMap | Date | JsonArray | JsonArray[]

interface JsonMap {
  [key: string]: AnyJson;
}

interface ISerializer {
  parse(src: string): JsonMap
  stringify(obj: JsonMap): string
}

export default class ConfigManager {
  constructor(opts: IConfigManagerOptions)
  current: object
  fullPath: string
  startWatching(): void
  stopWatching(): Promise<void>
  getSerializer(): ISerializer
  purgeEnv(): IEnv
  replaceEnv(configString: string): string
  parse(): Promise<void>
  validate(): boolean
  toFastifyPlugin(): FastifyPluginAsync
  update(config: JsonMap): Promise<boolean | undefined>
  save(): Promise<boolean|undefined>
  load(): Promise<string>
}

import { type InstanceOptions } from 'ajv'
import { type FastifyPluginAsync } from 'fastify'
import { FastifyError } from '@fastify/error'
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

export default class ConfigManager<T = object> {
  constructor(opts: IConfigManagerOptions)
  current: T
  fullPath: string
  getSerializer(): ISerializer
  purgeEnv(): IEnv
  replaceEnv(configString: string): string
  parse(): Promise<void>
  validate(): boolean
  toFastifyPlugin(): FastifyPluginAsync
  update(config: JsonMap): Promise<boolean | undefined>
  save(): Promise<boolean | undefined>
  load(): Promise<string>
}

/**
 * All the errors thrown by the plugin.
 */
export module errors {
  export const CannotFindEntityError: (entityName: string) => FastifyError

  export const ConfigurationDoesNotValidateAgainstSchemaError: FastifyError
  export const SourceMissingError: FastifyError
  export const InvalidPlaceholderError: (placeholder: string, suggestion: string) => FastifyError
  export const EnvVarMissingError: (envVarName: string) => FastifyError
  export const CannotParseConfigFileError: (error: string) => FastifyError
  export const ValidationErrors: (errors: string) => FastifyError
  export const AppMustBeAFunctionError: FastifyError
  export const SchemaMustBeDefinedError: FastifyError
  export const SchemaIdMustBeAStringError: FastifyError
  export const ConfigTypeMustBeAStringError: FastifyError
  export const AddAModulePropertyToTheConfigOrAddAKnownSchemaError: FastifyError
  export const VersionMismatchError: (currentVersion: string, requiredVersion: string) => FastifyError
  export const NoConfigFileFoundError: FastifyError
}


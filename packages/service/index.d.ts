import { BaseContext, BaseOptions, BaseStackable } from '@platformatic/basic'
import { BaseGenerator } from '@platformatic/generators'
import { kMetadata } from '@platformatic/utils'
import { JSONSchemaType } from 'ajv'
import { FastifyInstance } from 'fastify'
import { PlatformaticServiceConfig } from './config'

export { PlatformaticServiceConfig } from './config'

export interface ServiceContext extends BaseContext {
  applicationFactory?: typeof platformaticService
  fastifyPlugins?: Function[]
}

export type Configuration<Config> = Config & {
  [kMetadata]: {
    root: string
    path: string | null
    env: Record<string, string>
    module: { module: string; version: string } | null
  }
}

export interface PlatformaticApplication<Config> {
  config: Configuration<Config>
}

export type ServerInstance<Configuration = PlatformaticServiceConfig> = FastifyInstance & {
  platformatic: PlatformaticApplication<Configuration>
}

export declare function transform<T extends object> (config: T): Promise<T>

export declare function create (
  root: string,
  source?: string | PlatformaticServiceConfig,
  context?: object
): Promise<ServiceStackable>

export declare const skipTelemetryHooks: boolean

export declare function platformaticService (app: FastifyInstance, stackable: ServiceStackable): Promise<void>

export declare class Generator extends BaseGenerator.BaseGenerator {}

export declare const packageJson: Record<string, unknown>

export declare const schema: JSONSchemaType<PlatformaticServiceConfig>

export declare const schemaComponents: {
  $defs: JSONSchemaType<object>
  plugins: JSONSchemaType<object>
  openApiBase: JSONSchemaType<object>
  openapi: JSONSchemaType<object>
  proxy: JSONSchemaType<object>
  graphqlBase: JSONSchemaType<object>
  graphql: JSONSchemaType<object>
  service: JSONSchemaType<object>
  client: JSONSchemaType<object>
}

export declare const version: string

export declare class ServiceStackable<Config = PlatformaticServiceConfig> extends BaseStackable<
  Config,
  BaseOptions<ServiceContext>
> {
  constructor (root: string, config: Config, context?: object)
  getApplication (): FastifyInstance
}

import { BaseCapability, BaseContext, BaseOptions } from '@platformatic/basic'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import { BaseGenerator } from '@platformatic/generators'
import { JSONSchemaType } from 'ajv'
import { FastifyInstance } from 'fastify'
import type { PlatformaticServiceConfig } from './config.d.ts'

export type { PlatformaticServiceConfig } from './config.d.ts'

export interface ServiceContext extends BaseContext {
  applicationFactory?: typeof platformaticService
  fastifyPlugins?: Function[]
}

export interface PlatformaticApplication<Config> {
  config: Configuration<Config>
}

export type ServerInstance<Configuration = PlatformaticServiceConfig> = FastifyInstance & {
  platformatic: PlatformaticApplication<Configuration>
}

export type ServiceConfiguration<T = {}> = Configuration<PlatformaticServiceConfig & T>

export declare function transform (config: ServiceConfiguration): Promise<ServiceConfiguration>

export declare function loadConfiguration (
  root: string | PlatformaticServiceConfig,
  source?: string | PlatformaticServiceConfig,
  context?: ConfigurationOptions
): Promise<Configuration<PlatformaticServiceConfig>>

export declare function create (
  root: string | PlatformaticServiceConfig,
  source?: string | PlatformaticServiceConfig,
  context?: ConfigurationOptions
): Promise<ServiceCapability>

export declare const skipTelemetryHooks: boolean

export declare function platformaticService (app: FastifyInstance, capability: ServiceCapability): Promise<void>

export declare class Generator extends BaseGenerator {}
export declare function applyTestHelperCustomizations (
  helper: string,
  mod: string,
  customizations: Record<string, string>
): string

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
  application: JSONSchemaType<object>
}

export declare const version: string

export declare class ServiceCapability<Config = PlatformaticServiceConfig> extends BaseCapability<
  Config,
  BaseOptions<ServiceContext>
> {
  constructor (root: string, config: Config, context?: object)
  getApplication (): FastifyInstance
}

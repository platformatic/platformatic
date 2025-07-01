import type { BaseContext, BaseOptions, BaseStackable } from '@platformatic/basic'
import type { ConfigManager, ConfigManagerConfig } from '@platformatic/config'
import { BaseGenerator } from '@platformatic/generators'
import type { JSONSchemaType } from 'ajv'
import { FastifyInstance } from 'fastify'
import { PlatformaticServiceConfig } from './config'

export { PlatformaticServiceConfig } from './config'

export function platformaticService (app: FastifyInstance, stackable: BaseStackable): Promise<void>

export interface ServiceContext extends BaseContext {
  applicationFactory?: typeof platformaticService
  fastifyPlugins?: Function[]
}

export interface PlatformaticApplication<Config> {
  configManager: ConfigManager<Config>
  config: Config
}

export class Generator extends BaseGenerator.BaseGenerator {}

export class ServiceStackable<Config = PlatformaticServiceConfig> extends BaseStackable<
  Config,
  BaseOptions<ServiceContext>
> {
  constructor (opts: BaseOptions, root: string, configManager: ConfigManager<Config>)
  getApplication (): FastifyInstance
}

export type ServerInstance<Configuration = PlatformaticServiceConfig> = FastifyInstance & {
  platformatic: PlatformaticApplication<Configuration>
}

export function transformConfig (this: ConfigManager): Promise<void>

export function buildStackable (
  root: string,
  source: string | PlatformaticServiceConfig,
  opts: BaseOptions
): Promise<ServiceStackable>

export function create (
  root: string,
  source?: string | PlatformaticServiceConfig,
  opts?: object,
  context?: object
): Promise<ServiceStackable>

export const schema: JSONSchemaType<PlatformaticServiceConfig>

export const configType: 'service'

export const configManagerConfig: ConfigManagerConfig<PlatformaticServiceConfig>

export const version: string

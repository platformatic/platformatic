/// <reference types="mercurius" />
/// <reference types="@fastify/swagger" />

import type { BaseContext, BaseOptions, BaseStackable } from '@platformatic/basic'
import type { ConfigManager, ConfigManagerConfig } from '@platformatic/config'
import { BaseGenerator } from '@platformatic/generators'
import type { JSONSchemaType } from 'ajv'
import { FastifyInstance } from 'fastify'
import { PlatformaticService as PlatformaticServiceConfig } from './config'

export function platformaticService (app: FastifyInstance, stackable: BaseStackable): Promise<void>

export function registerCriticalPlugins (app: FastifyInstance, stackable: BaseStackable): Promise<void>

export interface ServiceContext extends BaseContext {
  applicationFactory?: typeof platformaticService
  fastifyPlugins?: Function[]
  criticalPluginsRegistered?: boolean
}

export class Generator extends BaseGenerator.BaseGenerator {}

export class ServiceStackable extends BaseStackable<PlatformaticServiceConfig, BaseOptions<ServiceContext>> {
  constructor (opts: BaseOptions, root: string, configManager: ConfigManager<PlatformaticServiceConfig>)
  getApplication (): FastifyInstance
}

export interface PlatformaticApplication<T> {
  configManager: ConfigManager<T>
  config: T
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
  opts?: object
): Promise<ServiceStackable>

export const schema: JSONSchemaType<PlatformaticServiceConfig>

export const configType: 'service'

export const configManagerConfig: ConfigManagerConfig<PlatformaticServiceConfig>

export const version: string

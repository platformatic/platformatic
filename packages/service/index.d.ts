/// <reference types="mercurius" />
/// <reference types="@fastify/swagger" />

import type { BaseContext, BaseOptions, BaseStackable } from '@platformatic/basic'
import type { ConfigManager, ConfigManagerConfig, StackableInterface } from '@platformatic/config'
import { BaseGenerator } from '@platformatic/generators'
import type { JSONSchemaType } from 'ajv'
import { FastifyInstance } from 'fastify'
import { PlatformaticService as PlatformaticServiceConfig } from './config'

export async function platformaticService (app: FastifyInstance, stackable: StackableInterface): Promise<void>

export interface ServiceContext extends BaseContext {
  applicationFactory?: typeof platformaticService
}

export class Generator extends BaseGenerator.BaseGenerator {}

export class ServiceStackable extends BaseStackable<PlatformaticServiceConfig, BaseOptions<ServiceContext>> {
  constructor (opts: BaseOptions, root: string, configManager: ConfigManager<PlatformaticServiceConfig>)
  getApplication (): FastifyInstance
}

export async function transformConfig (this: ConfigManager): Promise<void>

export async function buildStackable (
  root: string,
  source: string | PlatformaticServiceConfig,
  opts: BaseOptions
): Promise<ServiceStackable>

export async function createStackable (
  root: string,
  source?: string | PlatformaticServiceConfig,
  opts?: object
): Promise<ServiceStackable>

export const schema: JSONSchemaType<PlatformaticServiceConfig>

export const configType: 'service'

export const configManagerConfig: ConfigManagerConfig<PlatformaticServiceConfig>

export const version: string

export default {
  Generator,
  ServiceStackable,
  platformaticService,
  createStackable,
  transformConfig,
  configType,
  configManagerConfig,
  buildStackable,
  schema,
  version
}

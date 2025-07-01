import type { BaseContext, BaseOptions, BaseStackable } from '@platformatic/basic'
import type { ConfigManagerConfig } from '@platformatic/config'
import { BaseGenerator } from '@platformatic/generators'
import { ServerInstance as ServiceInstance, ServiceStackable } from '@platformatic/service'
import type { JSONSchemaType } from 'ajv'
import { FastifyInstance } from 'fastify'
import { PlatformaticComposerConfig } from './config'

export { PlatformaticApplication } from '@platformatic/service'
export { PlatformaticComposerConfig } from './config'

export function platformaticComposer (app: FastifyInstance, stackable: BaseStackable): Promise<void>

export interface ComposerContext extends BaseContext {
  applicationFactory?: typeof platformaticService
  fastifyPlugins?: Function[]
  criticalPluginsRegistered?: boolean
}

export class Generator extends BaseGenerator.BaseGenerator {}

export type ComposerStackable = ServiceStackable<PlatformaticComposerConfig>

export type ServerInstance = ServiceInstance<PlatformaticComposerConfig>

export function buildStackable (
  root: string,
  source: string | PlatformaticComposerConfig,
  opts: BaseOptions
): Promise<ComposerStackable>

export function create (
  root: string,
  source?: string | PlatformaticComposerConfig,
  opts?: object,
  context?: object
): Promise<ComposerStackable>

export const schema: JSONSchemaType<PlatformaticComposerConfig>

export const configType: 'service'

export const configManagerConfig: ConfigManagerConfig<PlatformaticComposerConfig>

export const version: string

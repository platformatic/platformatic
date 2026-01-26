import { BaseCapability } from '@platformatic/basic'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import {
  ServiceCapability,
  Generator as ServiceGenerator,
  PlatformaticServiceConfig,
  ServerInstance as ServiceServerInstance
} from '@platformatic/service'
import { JSONSchemaType } from 'ajv'
import { FastifyError, FastifyInstance } from 'fastify'
import type { PlatformaticGatewayConfig } from './config.d.ts'

export type { PlatformaticServiceConfig } from '@platformatic/service'
export type { PlatformaticGatewayConfig } from './config.d.ts'

export type GatewayCapability = ServiceCapability<PlatformaticGatewayConfig>

export type ServerInstance = ServiceServerInstance<PlatformaticGatewayConfig>

type GatewayConfiguration = Configuration<PlatformaticGatewayConfig>

export declare function loadConfiguration (
  root: string | PlatformaticServiceConfig,
  source?: string | PlatformaticServiceConfig,
  context?: ConfigurationOptions
): Promise<GatewayConfiguration>

export function create (
  root: string,
  source?: string | PlatformaticGatewayConfig,
  context?: ConfigurationOptions
): Promise<GatewayCapability>

export declare function platformaticGateway (app: FastifyInstance, capability: BaseCapability): Promise<void>

export class Generator extends ServiceGenerator {}

export declare const packageJson: Record<string, unknown>

export declare const schema: JSONSchemaType<PlatformaticGatewayConfig>

export declare const schemaComponents: {
  openApiApplication: JSONSchemaType<object>
  entityResolver: JSONSchemaType<object>
  entities: JSONSchemaType<object>
  graphqlApplication: JSONSchemaType<object>
  graphqlGatewayOptions: JSONSchemaType<object>
  gateway: JSONSchemaType<object>
  types: JSONSchemaType<object>
}

export declare const version: string

export function FastifyInstanceIsAlreadyListeningError (): FastifyError
export function FailedToFetchOpenAPISchemaError (): FastifyError
export function ValidationErrors (): FastifyError
export function PathAlreadyExistsError (): FastifyError
export function CouldNotReadOpenAPIConfigError (): FastifyError

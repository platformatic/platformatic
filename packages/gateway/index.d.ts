import { BaseCapability } from '@platformatic/basic'
import { BaseGenerator } from '@platformatic/generators'
import {
  ApplicationCapability,
  ServerInstance as ApplicationInstance,
  Configuration,
  ConfigurationOptions
} from '@platformatic/service'
import { JSONSchemaType } from 'ajv'
import { FastifyError, FastifyInstance } from 'fastify'
import { PlatformaticGatewayConfig } from './config'

export { PlatformaticService } from '@platformatic/service'
export { PlatformaticGatewayConfig } from './config'

export type GatewayCapability = ApplicationCapability<PlatformaticGatewayConfig>

export type ServerInstance = ApplicationInstance<PlatformaticGatewayConfig>

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

export class Generator extends BaseGenerator.BaseGenerator {}

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

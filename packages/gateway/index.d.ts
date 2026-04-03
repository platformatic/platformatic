import { BaseCapability } from '@platformatic/basic'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import {
  ServiceCapability,
  Generator as ServiceGenerator,
  ServerInstance as ServiceServerInstance
} from '@platformatic/service'
import { JSONSchemaType } from 'ajv'
import { FastifyError, FastifyInstance } from 'fastify'
import type { PlatformaticGatewayConfig } from './config.d.ts'

export interface GatewayCommand {
  usage: string
  description: string
}

export interface GatewayCommandDefinition {
  commands: Record<string, (...args: unknown[]) => Promise<void> | void>
  help: Record<string, GatewayCommand>
}

export type { PlatformaticServiceConfig } from '@platformatic/service'
export type { PlatformaticGatewayConfig } from './config.d.ts'

export type GatewayCapability = ServiceCapability<PlatformaticGatewayConfig>

export type ServerInstance = ServiceServerInstance<PlatformaticGatewayConfig>

type GatewayConfiguration = Configuration<PlatformaticGatewayConfig>

export declare function loadConfiguration (
  root: string | PlatformaticGatewayConfig,
  source?: string | PlatformaticGatewayConfig,
  context?: ConfigurationOptions
): Promise<GatewayConfiguration>

export function create (
  root: string | PlatformaticGatewayConfig,
  source?: string | PlatformaticGatewayConfig,
  context?: ConfigurationOptions
): Promise<GatewayCapability>

export declare function platformaticGateway (app: FastifyInstance, capability: BaseCapability): Promise<void>

export declare function createCommands (id: string): GatewayCommandDefinition

export class Generator extends ServiceGenerator {}

export declare const packageJson: Record<string, unknown>

export declare const schema: JSONSchemaType<PlatformaticGatewayConfig>

export declare const schemaComponents: {
  openApiApplication: JSONSchemaType<object>
  entityResolver: JSONSchemaType<object>
  entities: JSONSchemaType<object>
  graphqlApplication: JSONSchemaType<object>
  graphqlComposerOptions: JSONSchemaType<object>
  gateway: JSONSchemaType<object>
  types: JSONSchemaType<object>
}

export declare const skipTelemetryHooks: boolean

export declare const version: string

export namespace errors {
  export const FastifyInstanceIsAlreadyListeningError: () => FastifyError
  export const FailedToFetchOpenAPISchemaError: () => FastifyError
  export const ValidationErrors: () => FastifyError
  export const PathAlreadyExistsError: () => FastifyError
  export const CouldNotReadOpenAPIConfigError: () => FastifyError
}

import { BaseCapability } from '@platformatic/basic'
import { BaseGenerator } from '@platformatic/generators'
import {
  Configuration,
  ConfigurationOptions,
  ServiceCapability,
  ServerInstance as ServiceInstance
} from '@platformatic/service'
import { JSONSchemaType } from 'ajv'
import { FastifyError, FastifyInstance } from 'fastify'
import { PlatformaticComposerConfig } from './config'

export { PlatformaticApplication } from '@platformatic/service'
export { PlatformaticComposerConfig } from './config'

export type ComposerCapability = ServiceCapability<PlatformaticComposerConfig>

export type ServerInstance = ServiceInstance<PlatformaticComposerConfig>

type ComposerConfiguration = Configuration<PlatformaticComposerConfig>

export declare function loadConfiguration (
  root: string | PlatformaticServiceConfig,
  source?: string | PlatformaticServiceConfig,
  context?: ConfigurationOptions
): Promise<ComposerConfiguration>

export function create (
  root: string,
  source?: string | PlatformaticComposerConfig,
  context?: ConfigurationOptions
): Promise<ComposerCapability>

export declare function platformaticComposer (app: FastifyInstance, capability: BaseCapability): Promise<void>

export class Generator extends BaseGenerator.BaseGenerator {}

export declare const packageJson: Record<string, unknown>

export declare const schema: JSONSchemaType<PlatformaticComposerConfig>

export declare const schemaComponents: {
  openApiService: JSONSchemaType<object>
  entityResolver: JSONSchemaType<object>
  entities: JSONSchemaType<object>
  graphqlService: JSONSchemaType<object>
  graphqlComposerOptions: JSONSchemaType<object>
  composer: JSONSchemaType<object>
  types: JSONSchemaType<object>
}

export declare const version: string

export function FastifyInstanceIsAlreadyListeningError (): FastifyError
export function FailedToFetchOpenAPISchemaError (): FastifyError
export function ValidationErrors (): FastifyError
export function PathAlreadyExistsError (): FastifyError
export function CouldNotReadOpenAPIConfigError (): FastifyError

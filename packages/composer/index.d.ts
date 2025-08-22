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
import { PlatformaticComposerConfig } from './config'

export { PlatformaticService } from '@platformatic/service'
export { PlatformaticComposerConfig } from './config'

export type ComposerCapability = ApplicationCapability<PlatformaticComposerConfig>

export type ServerInstance = ApplicationInstance<PlatformaticComposerConfig>

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
  openApiApplication: JSONSchemaType<object>
  entityResolver: JSONSchemaType<object>
  entities: JSONSchemaType<object>
  graphqlApplication: JSONSchemaType<object>
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

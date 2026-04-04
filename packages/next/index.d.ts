import { BaseCapability, BaseContext, BaseOptions } from '@platformatic/basic'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import { JSONSchemaType } from 'ajv'
import { FastifyError } from 'fastify'
import type { PlatformaticNextJsConfig } from './config.d.ts'

export type { PlatformaticNextJsConfig } from './config.d.ts'

export interface NextContext extends BaseContext {}

export type NextConfiguration = Configuration<PlatformaticNextJsConfig>

export declare function transform (
  config: NextConfiguration,
  schema?: object,
  options?: ConfigurationOptions
): Promise<NextConfiguration>

export declare function getAdapterPath (): string

export declare function enhanceNextConfig (nextConfig: any, ...args: unknown[]): Promise<any>

export declare function loadConfiguration (
  root: string | PlatformaticNextJsConfig,
  source?: string | PlatformaticNextJsConfig,
  context?: ConfigurationOptions
): Promise<NextConfiguration>

export declare function create (
  configOrRoot: string | PlatformaticNextJsConfig,
  sourceOrConfig?: string | PlatformaticNextJsConfig,
  context?: ConfigurationOptions
): Promise<NextCapability | NextImageOptimizerCapability>

export declare class NextCapability extends BaseCapability<PlatformaticNextJsConfig, BaseOptions<NextContext>> {
  constructor (root: string, config: PlatformaticNextJsConfig, context?: object)
}

export declare class NextImageOptimizerCapability extends BaseCapability<
  PlatformaticNextJsConfig,
  BaseOptions<NextContext>
> {
  constructor (root: string, config: PlatformaticNextJsConfig, context?: object)
}

export declare const packageJson: Record<string, unknown>
export declare const schema: JSONSchemaType<PlatformaticNextJsConfig>
export declare const schemaComponents: { next: JSONSchemaType<object> }
export declare const version: string
export declare const supportedVersions: string[]

export declare function getCacheHandlerPath (name: string): string

export namespace errors {
  export const StandaloneServerNotFound: () => FastifyError
  export const CannotParseStandaloneServer: () => FastifyError
}

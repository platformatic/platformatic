import { BaseCapability, BaseContext, BaseOptions } from '@platformatic/basic'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import { JSONSchemaType } from 'ajv'
import type { PlatformaticReactRouterConfig } from './config.d.ts'

export type { PlatformaticReactRouterConfig } from './config.d.ts'

export interface ReactRouterContext extends BaseContext {}

export type ReactRouterConfiguration = Configuration<PlatformaticReactRouterConfig>

export declare function transform (config: ReactRouterConfiguration): Promise<ReactRouterConfiguration>

export declare function loadConfiguration (
  root: string | PlatformaticReactRouterConfig,
  source?: string | PlatformaticReactRouterConfig,
  context?: ConfigurationOptions
): Promise<ReactRouterConfiguration>

export declare function create (
  configOrRoot: string | PlatformaticReactRouterConfig,
  sourceOrConfig?: string | PlatformaticReactRouterConfig,
  context?: ConfigurationOptions
): Promise<ReactRouterCapability>

export declare class ReactRouterCapability extends BaseCapability<
  PlatformaticReactRouterConfig,
  BaseOptions<ReactRouterContext>
> {
  constructor (root: string, config: PlatformaticReactRouterConfig, context?: object)
}

export declare const packageJson: Record<string, unknown>
export declare const schema: JSONSchemaType<PlatformaticReactRouterConfig>
export declare const schemaComponents: { reactRouter: JSONSchemaType<object> }
export declare const version: string
export declare const supportedVersions: string

import { BaseCapability, BaseContext, BaseOptions } from '@platformatic/basic'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import { JSONSchemaType } from 'ajv'
import type { PlatformaticAstroConfig } from './config.d.ts'

export type { PlatformaticAstroConfig } from './config.d.ts'

export interface AstroContext extends BaseContext {}

export type AstroConfiguration = Configuration<PlatformaticAstroConfig>

export declare function transform (config: AstroConfiguration): Promise<AstroConfiguration>

export declare function loadConfiguration (
  root: string | PlatformaticAstroConfig,
  source?: string | PlatformaticAstroConfig,
  context?: ConfigurationOptions
): Promise<AstroConfiguration>

export declare function create (
  configOrRoot: string | PlatformaticAstroConfig,
  sourceOrConfig?: string | PlatformaticAstroConfig,
  context?: ConfigurationOptions
): Promise<AstroCapability>

export declare class AstroCapability extends BaseCapability<PlatformaticAstroConfig, BaseOptions<AstroContext>> {
  constructor (root: string, config: PlatformaticAstroConfig, context?: object)
}

export declare const packageJson: Record<string, unknown>
export declare const schema: JSONSchemaType<PlatformaticAstroConfig>
export declare const schemaComponents: { astro: JSONSchemaType<object> }
export declare const version: string
export declare const supportedVersions: string

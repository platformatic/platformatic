import { BaseCapability, BaseContext, BaseOptions } from '@platformatic/basic'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import { JSONSchemaType } from 'ajv'
import type { PlatformaticNestJSConfig } from './config.d.ts'

export type { PlatformaticNestJSConfig } from './config.d.ts'

export interface NestContext extends BaseContext {}

export type NestConfiguration = Configuration<PlatformaticNestJSConfig>

export declare function transform (config: NestConfiguration): Promise<NestConfiguration>

export declare function loadConfiguration (
  root: string | PlatformaticNestJSConfig,
  source?: string | PlatformaticNestJSConfig,
  context?: ConfigurationOptions
): Promise<NestConfiguration>

export declare function create (
  configOrRoot: string | PlatformaticNestJSConfig,
  sourceOrConfig?: string | PlatformaticNestJSConfig,
  context?: ConfigurationOptions
): Promise<NestCapability>

export declare class NestCapability extends BaseCapability<PlatformaticNestJSConfig, BaseOptions<NestContext>> {
  constructor (root: string, config: PlatformaticNestJSConfig, context?: object)
}

export declare const packageJson: Record<string, unknown>
export declare const schema: JSONSchemaType<PlatformaticNestJSConfig>
export declare const schemaComponents: { nest: JSONSchemaType<object> }
export declare const version: string
export declare const supportedVersions: string

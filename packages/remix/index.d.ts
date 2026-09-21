import { BaseCapability, BaseContext, BaseOptions } from '@platformatic/basic'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import { JSONSchemaType } from 'ajv'
import type { PlatformaticRemixConfig } from './config.d.ts'

export type { PlatformaticRemixConfig } from './config.d.ts'

export interface RemixContext extends BaseContext {}

export type RemixConfiguration = Configuration<PlatformaticRemixConfig>

export declare function transform (
  config: RemixConfiguration,
  schema?: object,
  options?: ConfigurationOptions
): Promise<RemixConfiguration>

export declare function loadConfiguration (
  root: string | PlatformaticRemixConfig,
  source?: string | PlatformaticRemixConfig,
  context?: ConfigurationOptions
): Promise<RemixConfiguration>

export declare function create (
  configOrRoot: string | PlatformaticRemixConfig,
  sourceOrConfig?: string | PlatformaticRemixConfig,
  context?: ConfigurationOptions
): Promise<RemixCapability>

export declare class RemixCapability extends BaseCapability<PlatformaticRemixConfig, BaseOptions<RemixContext>> {
  constructor (root: string, config: PlatformaticRemixConfig, context?: object)
}

export declare const packageJson: Record<string, unknown>
export declare const schema: JSONSchemaType<PlatformaticRemixConfig>
export declare const schemaComponents: { remix: JSONSchemaType<object> }
export declare const version: string
export declare const supportedVersions: string

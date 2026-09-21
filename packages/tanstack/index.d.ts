import { BaseCapability, BaseContext, BaseOptions } from '@platformatic/basic'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import { JSONSchemaType } from 'ajv'
import type { PlatformaticTanStackConfig } from './config.d.ts'

export type { PlatformaticTanStackConfig } from './config.d.ts'

export interface TanstackContext extends BaseContext {}

export type TanstackConfiguration = Configuration<PlatformaticTanStackConfig>

export declare function loadConfiguration (
  root: string | PlatformaticTanStackConfig,
  source?: string | PlatformaticTanStackConfig,
  context?: ConfigurationOptions
): Promise<TanstackConfiguration>

export declare function create (
  configOrRoot: string | PlatformaticTanStackConfig,
  sourceOrConfig?: string | PlatformaticTanStackConfig,
  context?: ConfigurationOptions
): Promise<TanstackCapability>

export declare class TanstackCapability extends BaseCapability<
  PlatformaticTanStackConfig,
  BaseOptions<TanstackContext>
> {
  constructor (root: string, config: PlatformaticTanStackConfig, context?: object)
}

export declare const packageJson: Record<string, unknown>
export declare const schema: JSONSchemaType<PlatformaticTanStackConfig>
export declare const schemaComponents: {}
export declare const version: string
export declare const supportedVersions: string

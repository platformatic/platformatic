import { BaseCapability, BaseContext, BaseOptions } from '@platformatic/basic'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import { JSONSchemaType } from 'ajv'
import type { PlatformaticViteConfig } from './config.d.ts'

export type { PlatformaticViteConfig } from './config.d.ts'

export interface ViteContext extends BaseContext {}

export type ViteConfiguration = Configuration<PlatformaticViteConfig>

export declare function transform (config: ViteConfiguration): Promise<ViteConfiguration>

export declare function loadConfiguration (
  root: string | PlatformaticViteConfig,
  source?: string | PlatformaticViteConfig,
  context?: ConfigurationOptions
): Promise<ViteConfiguration>

export declare function create (
  configOrRoot: string | PlatformaticViteConfig,
  sourceOrConfig?: string | PlatformaticViteConfig,
  context?: ConfigurationOptions
): Promise<ViteCapability | ViteSSRCapability>

export declare class ViteCapability extends BaseCapability<PlatformaticViteConfig, BaseOptions<ViteContext>> {
  outputDirectory?: string
  buildInfoPath?: string

  constructor (root: string, config: PlatformaticViteConfig, context?: object)
}

export declare class ViteSSRCapability extends ViteCapability {
  constructor (root: string, config: PlatformaticViteConfig, context?: object)
}

export declare const packageJson: Record<string, unknown>
export declare const schema: JSONSchemaType<PlatformaticViteConfig>
export declare const schemaComponents: { vite: JSONSchemaType<object> }
export declare const version: string
export declare const supportedVersions: string[]

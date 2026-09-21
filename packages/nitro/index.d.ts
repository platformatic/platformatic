import { BaseCapability, BaseContext, BaseOptions } from '@platformatic/basic'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import { ViteCapability } from '@platformatic/vite'
import { JSONSchemaType } from 'ajv'
import type { PlatformaticNitroConfig } from './config.d.ts'

export type { PlatformaticNitroConfig } from './config.d.ts'

export interface NitroContext extends BaseContext {}
export type NitroConfiguration = Configuration<PlatformaticNitroConfig>

export interface ResolvedNitroPackage {
  name: 'nitro' | 'nitropack'
  root: string
  packageJson: {
    version: string
    [key: string]: unknown
  }
}

export declare function resolveNitroPackage (root: string): Promise<ResolvedNitroPackage>
export declare function hasViteConfigFile (root: string, config?: PlatformaticNitroConfig): boolean

export declare function transform (
  config: NitroConfiguration,
  schema?: object,
  options?: ConfigurationOptions
): Promise<NitroConfiguration>

export declare function loadConfiguration (
  root: string | PlatformaticNitroConfig,
  source?: string | PlatformaticNitroConfig,
  context?: ConfigurationOptions
): Promise<NitroConfiguration>

export declare function create (
  configOrRoot: string | PlatformaticNitroConfig,
  sourceOrConfig?: string | PlatformaticNitroConfig,
  context?: ConfigurationOptions
): Promise<NitroCapability | NitroViteCapability>

export declare class NitroCapability extends BaseCapability<PlatformaticNitroConfig, BaseOptions<NitroContext>> {
  constructor (root: string, config: PlatformaticNitroConfig, context?: object)
}

export declare class NitroViteCapability extends ViteCapability {
  constructor (root: string, config: PlatformaticNitroConfig, context?: object)
}

export declare const packageJson: Record<string, unknown>
export declare const schema: JSONSchemaType<PlatformaticNitroConfig>
export declare const schemaComponents: { nitro: JSONSchemaType<object> }
export declare const version: string
export declare const supportedVersions: { nitro: string, nitropack: string }

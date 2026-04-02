import { BaseCapability, BaseContext, BaseOptions } from '@platformatic/basic'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import { BaseGenerator } from '@platformatic/generators'
import { JSONSchemaType } from 'ajv'
import type { PlatformaticNodeJsConfig } from './config.d.ts'

export type { PlatformaticNodeJsConfig } from './config.d.ts'

export interface NodeContext extends BaseContext {}

export type NodeConfiguration = Configuration<PlatformaticNodeJsConfig>

export declare function transform (config: NodeConfiguration): Promise<NodeConfiguration>

export declare function loadConfiguration (
  root: string | PlatformaticNodeJsConfig,
  source?: string | PlatformaticNodeJsConfig,
  context?: ConfigurationOptions
): Promise<NodeConfiguration>

export declare function create (
  configOrRoot: string | PlatformaticNodeJsConfig,
  sourceOrConfig?: string | PlatformaticNodeJsConfig,
  context?: ConfigurationOptions
): Promise<NodeCapability>

export declare class Generator extends BaseGenerator {}

export declare const packageJson: Record<string, unknown>
export declare const schema: JSONSchemaType<PlatformaticNodeJsConfig>
export declare const schemaComponents: { node: JSONSchemaType<object> }
export declare const version: string

export declare class NodeCapability extends BaseCapability<PlatformaticNodeJsConfig, BaseOptions<NodeContext>> {
  constructor (root: string, config: PlatformaticNodeJsConfig, context?: object)
}

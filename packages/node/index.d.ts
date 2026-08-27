import { ApplicationDefinition, BaseCapability, BaseContext, BaseOptions, CapabilityFactoryOptions, ConfigContext, DeferredApplicationDefinition } from '@platformatic/basic'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import { BaseGenerator } from '@platformatic/generators'
import { JSONSchemaType } from 'ajv'
import type { PlatformaticNodeJsConfig } from './config.d.ts'

export type { PlatformaticNodeJsConfig } from './config.d.ts'

export interface NodeContext extends BaseContext {}

export type NodeConfiguration = Configuration<PlatformaticNodeJsConfig>

export declare function transform (
  config: NodeConfiguration,
  schema?: object,
  options?: ConfigurationOptions
): Promise<NodeConfiguration>

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
  closeServer (): Promise<void> | undefined
  getScheduledTasks (): Promise<Array<{ id: string, cron: string, tasks: string[] }>>
  runScheduledTasks (scheduleId: string, scheduledTime: number): Promise<unknown[]>
}

export type NodeConfigOptions = CapabilityFactoryOptions<PlatformaticNodeJsConfig, 'node', never>

export declare function node (options?: NodeConfigOptions): ApplicationDefinition
export declare function node (
  callback: (context: ConfigContext) => NodeConfigOptions | Promise<NodeConfigOptions>
): DeferredApplicationDefinition

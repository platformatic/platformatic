import { BaseCapability, BaseContext, BaseOptions } from '@platformatic/basic'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import { BaseGenerator } from '@platformatic/generators'
import { JSONSchemaType } from 'ajv'
import type { PlatformaticLavoratoreConfig } from './config.d.ts'

export type { PlatformaticLavoratoreConfig } from './config.d.ts'

export interface LavoratoreContext extends BaseContext {}

export type LavoratoreConfiguration = Configuration<PlatformaticLavoratoreConfig>

export declare function transform (
  config: LavoratoreConfiguration,
  schema?: object,
  options?: ConfigurationOptions
): Promise<LavoratoreConfiguration>

export declare function loadConfiguration (
  root: string | PlatformaticLavoratoreConfig,
  source?: string | PlatformaticLavoratoreConfig,
  context?: ConfigurationOptions
): Promise<LavoratoreConfiguration>

export declare function create (
  configOrRoot: string | PlatformaticLavoratoreConfig,
  sourceOrConfig?: string | PlatformaticLavoratoreConfig,
  context?: ConfigurationOptions
): Promise<LavoratoreCapability>

export declare const wranglerConfigFiles: string[]
export declare function findWranglerConfigFile (root: string, configFile?: string): string | null
export declare function loadWranglerConfig (
  root: string,
  configFile?: string,
  environment?: string
): Promise<{ path: string | null, config: Record<string, unknown> }>

export declare class Generator extends BaseGenerator {}

export declare const packageJson: Record<string, unknown>
export declare const schema: JSONSchemaType<PlatformaticLavoratoreConfig>
export declare const schemaComponents: { lavoratore: JSONSchemaType<object> }
export declare const version: string

export declare class LavoratoreCapability extends BaseCapability<
  PlatformaticLavoratoreConfig,
  BaseOptions<LavoratoreContext>
> {
  constructor (root: string, config: PlatformaticLavoratoreConfig, context?: object)
  getScheduledTasks (): Promise<Array<{ id: string, cron: string, tasks: string[] }>>
  runScheduledTasks (scheduleId: string, scheduledTime: number): Promise<string[]>
}

import { BaseCapability, BaseContext, BaseOptions } from '@platformatic/basic'
import { Configuration, ConfigurationOptions } from '@platformatic/foundation'
import { JSONSchemaType } from 'ajv'
import type { PlatformaticNuxtConfig } from './config.d.ts'

export type { PlatformaticNuxtConfig } from './config.d.ts'

export interface NuxtContext extends BaseContext {}

export type NuxtConfiguration = Configuration<PlatformaticNuxtConfig>

export interface NuxtSchedule {
  id: string
  cron: string
  tasks: string[]
}

export declare function loadConfiguration (
  root: string | PlatformaticNuxtConfig,
  source?: string | PlatformaticNuxtConfig,
  context?: ConfigurationOptions
): Promise<NuxtConfiguration>

export declare function create (
  configOrRoot: string | PlatformaticNuxtConfig,
  sourceOrConfig?: string | PlatformaticNuxtConfig,
  context?: ConfigurationOptions
): Promise<NuxtCapability>

export declare class NuxtCapability extends BaseCapability<
  PlatformaticNuxtConfig,
  BaseOptions<NuxtContext>
> {
  constructor (root: string, config: PlatformaticNuxtConfig, context?: object)
  getScheduledTasks (): Promise<NuxtSchedule[]>
  runScheduledTasks (scheduleId: string, scheduledTime: number): Promise<unknown>
}

export declare const packageJson: Record<string, unknown>
export declare const schema: JSONSchemaType<PlatformaticNuxtConfig>
export declare const schemaComponents: { nuxt: unknown }
export declare const version: string
export declare const supportedVersions: string

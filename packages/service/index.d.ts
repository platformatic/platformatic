/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference types="mercurius" />
/// <reference types="@fastify/swagger" />
import { FastifyInstance, FastifyBaseLogger } from 'fastify'
import ConfigManager from '@platformatic/config'
import type { IConfigManagerOptions } from '@platformatic/config'
import { PlatformaticService } from './config'
import type { JSONSchemaType } from 'ajv'
import { ServiceGenerator } from './lib/generator/service-generator'
export interface PlatformaticApp<T> {
  configManager: ConfigManager<T>
  config: T
}

export type PlatformaticServiceConfig = PlatformaticService

export function buildServer (opts: object, app?: object, ConfigManagerContructor?: object): Promise<FastifyInstance>
export function start (app: FastifyInstance, args: string[]): Promise<void>

declare module 'fastify' {
  interface FastifyInstance {
    restart: () => Promise<void>
  }
}

export interface ConfigManagerConfig<T> extends Omit<IConfigManagerOptions, 'source' | 'watch' | 'schema'> {
  transformConfig: (this: ConfigManager<T>) => Promise<void>
  schema: object
}

export interface Stackable<ConfigType> {
  (app: FastifyInstance, opts: object): Promise<void>

  configType: string
  configManagerConfig: ConfigManagerConfig<ConfigType>
  schema: object
}

interface SchemaExport {
  schema: JSONSchemaType<PlatformaticServiceConfig>
}

interface TSCompilerOptions {
  clean: boolean
}
interface TSCompiler {
  compile: (cwd: string, config: object, originalLogger: FastifyBaseLogger, options: TSCompilerOptions) => Promise<boolean>
}
export const schema: SchemaExport

export declare const platformaticService: Stackable<PlatformaticServiceConfig>

export default platformaticService

export const tsCompiler: TSCompiler

export import Generator = ServiceGenerator.ServiceGenerator

/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference types="mercurius" />
/// <reference types="@fastify/swagger" />
import { FastifyInstance, FastifyBaseLogger } from 'fastify'
import ConfigManager from '@platformatic/config'
import type { IConfigManagerOptions } from '@platformatic/config'
import { BaseGenerator } from '@platformatic/generators'
import { PlatformaticService } from './config'
import type { JSONSchemaType } from 'ajv'
import { ServiceGenerator } from './lib/generator/service-generator'

/* eslint-disable @typescript-eslint/no-unused-vars */
export import Generator = ServiceGenerator.ServiceGenerator

export interface PlatformaticApp<T> {
  configManager: ConfigManager<T>
  config: T
}

export type PlatformaticServiceConfig = PlatformaticService

export function buildServer (opts: object, app?: object, ConfigManagerConstructor?: object): Promise<FastifyInstance>
export function start<ConfigType> (app: Stackable<ConfigType>, args: string[]): Promise<void>

declare module 'fastify' {
  interface FastifyInstance {
    restart: () => Promise<void>
  }
}

export interface ConfigManagerConfig<T> extends Omit<IConfigManagerOptions, 'source' | 'watch' | 'schema' | 'configVersion'> {
  transformConfig: (this: ConfigManager<T>) => Promise<void>
  schema: object
}

export interface Stackable<ConfigType> {
  (app: FastifyInstance, opts: object): Promise<void>

  configType: string
  configManagerConfig: ConfigManagerConfig<ConfigType>
  schema: object
  Generator?: new () => BaseGenerator.BaseGenerator

  version?: string
  upgrade?: (config: any, version: string) => Promise<any>
  transformConfig?: (config: any) => Promise<any>
}

interface TSCompilerOptions {
  clean: boolean
}
interface TSCompiler {
  compile: (cwd: string, config: object, originalLogger: FastifyBaseLogger, options: TSCompilerOptions) => Promise<boolean>
}

export const schema: JSONSchemaType<PlatformaticServiceConfig>

export declare const platformaticService: Stackable<PlatformaticServiceConfig>

export default platformaticService

export const tsCompiler: TSCompiler

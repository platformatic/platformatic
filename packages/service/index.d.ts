/// <reference types="mercurius" />
/// <reference types="@fastify/swagger" />
import { FastifyInstance, FastifyBaseLogger } from 'fastify'
import ConfigManager from '@platformatic/config'
import type { Stackable as _Stackable, StackableInterface, ConfigManagerConfig } from '@platformatic/config'
import { BaseGenerator } from '@platformatic/generators'
import { PlatformaticService } from './config'
import type { JSONSchemaType } from 'ajv'
import { ServiceGenerator } from './lib/generator/service-generator'

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

type DefaultGenerator = new () => BaseGenerator.BaseGenerator

export interface Stackable<ConfigType, Generator = DefaultGenerator> extends _Stackable<ConfigType> {
  app: (app: FastifyInstance, opts: object) => Promise<void>
  Generator?: Generator
  version?: string
  upgrade?: (config: any, version: string) => Promise<any>
  transformConfig?: (config: any) => Promise<any>
  buildStackable: (opts: { config: string }, app?: object) => Promise<StackableInterface>
}

interface TSCompilerOptions {
  clean: boolean
}
interface TSCompiler {
  compile: (cwd: string, config: object, originalLogger: FastifyBaseLogger, options: TSCompilerOptions) => Promise<boolean>
}

export const schema: JSONSchemaType<PlatformaticServiceConfig>
export const configManagerConfig: ConfigManagerConfig<PlatformaticServiceConfig>

export declare const platformaticService: Stackable<PlatformaticServiceConfig>

export declare const app: (app: FastifyInstance, opts: object) => Promise<void>

export const tsCompiler: TSCompiler

type defaultExport = Stackable<PlatformaticServiceConfig> & {
  buildServer: (opts: object, app?: object, ConfigManagerConstructor?: object) => Promise<FastifyInstance>,
  start: <ConfigType>(app: Stackable<ConfigType>, args: string[]) => Promise<void>,
  tsCompiler: TSCompiler,
  schema: JSONSchemaType<PlatformaticServiceConfig>,
}

export function buildStackable (opts: { config: string }, app?: object): Promise<StackableInterface>

export default defaultExport

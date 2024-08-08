/// <reference types="mercurius" />
/// <reference types="@fastify/swagger" />
import { FastifyInstance, FastifyBaseLogger } from 'fastify'
import ConfigManager from '@platformatic/config'
import type { ConfigManagerConfig } from '@platformatic/config'
import type { Stackable as _Stackable } from '@platformatic/config'
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

export interface StartOptions {
  listen?: boolean
}

export interface StackableInfo {
  type: string
  version: string
}

export interface StackableInterface {
  init: () => Promise<void>
  start: (options: StartOptions) => Promise<void>
  stop: () => Promise<void>
  getUrl: () => string
  getConfig: () => Promise<object>
  getInfo: () => Promise<StackableInfo>
  getDispatchFunc: () => Promise<Function>
  getOpenapiSchema: () => Promise<object>
  getGraphqlSchema: () => Promise<string>
  getMetrics: () => Promise<string>
  inject: (injectParams: object) => Promise<{
    statusCode: number
    statusMessage: string
    headers: object
    body: object
  }>
}

export function buildStackable<ConfigType> (opts: object, app?: object): Promise<{
  configType: string,
  configManager?: ConfigManager<ConfigType>,
  configManagerConfig?: ConfigManagerConfig<ConfigType>,
  schema?: object,
  stackable?: StackableInterface
}>

export interface Stackable<ConfigType, Generator = DefaultGenerator> extends _Stackable<ConfigType> {
  app: (app: FastifyInstance, opts: object) => Promise<void>
  Generator?: Generator
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

export default defaultExport

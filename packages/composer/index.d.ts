import { FastifyInstance } from 'fastify'
import ConfigManager from '@platformatic/config'
import type { ConfigManagerConfig, StackableInterface } from '@platformatic/config'
import { PlatformaticComposer } from './config'

export { PlatformaticApp } from '@platformatic/service'
export type PlatformaticComposerConfig = PlatformaticComposer

export function buildServer (opts: object, app?: object, ConfigManagerContructor?: object): Promise<FastifyInstance>

export function buildStackable (opts: object, app?: object): Promise<{
  configType: string,
  configManager?: ConfigManager<PlatformaticComposerConfig>,
  configManagerConfig?: ConfigManagerConfig<PlatformaticComposerConfig>,
  schema?: object,
  stackable?: StackableInterface
}>

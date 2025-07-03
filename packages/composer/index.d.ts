import type { ConfigManagerConfig, StackableInterface } from '@platformatic/config'
import ConfigManager from '@platformatic/config'
import { FastifyInstance } from 'fastify'
import { PlatformaticComposer } from './config'
import { ComposerStackable } from './lib/stackable'

export { PlatformaticApp } from '@platformatic/service'
export type PlatformaticComposerConfig = PlatformaticComposer

export function buildServer (opts: object, app?: object, ConfigManagerContructor?: object): Promise<FastifyInstance>

export function buildStackable (
  opts: object,
  app?: object
): Promise<{
  configType: string
  configManager?: ConfigManager<PlatformaticComposerConfig>
  configManagerConfig?: ConfigManagerConfig<PlatformaticComposerConfig>
  schema?: object
  stackable?: StackableInterface
}>

export function create (
  root: string,
  source?: string | PlatformaticComposerConfig,
  opts?: object,
  context?: object
): Promise<ComposerStackable>

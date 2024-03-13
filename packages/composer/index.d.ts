import { FastifyInstance } from 'fastify'
import { PlatformaticComposer } from './config'

export { PlatformaticApp } from '@platformatic/service'
export type PlatformaticComposerConfig = PlatformaticComposer

export function buildServer (opts: object, app?: object, ConfigManagerContructor?: object): Promise<FastifyInstance>

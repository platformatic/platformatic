import { FastifyInstance } from 'fastify'
import { HttpsPlatformaticDevSchemasV180Composer } from './config'

export { PlatformaticApp } from '@platformatic/service'
export type PlatformaticComposerConfig = HttpsPlatformaticDevSchemasV180Composer

export function buildServer (opts: object, app?: object, ConfigManagerContructor?: object): Promise<FastifyInstance>

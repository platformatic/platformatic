import { FastifyInstance } from 'fastify'
import { HttpsPlatformaticDevSchemasV1144Composer } from './config'

export { PlatformaticApp } from '@platformatic/service'
export type PlatformaticComposerConfig = HttpsPlatformaticDevSchemasV1144Composer

export function buildServer (opts: object, app?: object, ConfigManagerContructor?: object): Promise<FastifyInstance>

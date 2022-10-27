import { FastifyPluginAsync } from 'fastify'
import { Readable } from 'stream'
import { SQLMapperPluginInterface } from '@platformatic/sql-mapper'

declare module 'fastify' {
  interface SQLMapperPluginInterface {
    subscribe: (topic: string | string[]) => Promise<Readable>
  }

  interface FastifyInstance {
    platformatic: SQLMapperPluginInterface
  }
}

export interface SQLEventsPluginOptions {
  mapper: SQLMapperPluginInterface

  // TODO mqemitter has no types
  mq?: any
  connectionString?: String
}

/**
 * Fastify plugin that add events capabilities to registered sql-mapper 
 */
declare const plugin: FastifyPluginAsync<SQLEventsPluginOptions>

export default plugin

export function setupEmitter(options: SQLEventsPluginOptions): void

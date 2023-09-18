import { FastifyPluginAsync } from 'fastify'
import { Readable } from 'stream'
import { SQLMapperPluginInterface } from '@platformatic/sql-mapper'

export interface SQLEventsPluginInterface {
  subscribe: (topic: string | string[]) => Promise<Readable>
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

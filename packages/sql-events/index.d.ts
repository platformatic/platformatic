import { FastifyPluginAsync } from 'fastify'
import { Readable } from 'stream'
import { SQLMapperPluginInterface, Entities } from '@platformatic/sql-mapper'

export interface SQLEventsPluginInterface {
  subscribe: (topic: string | string[]) => Promise<Readable>
}

export interface SQLEventsPluginOptions<T extends Entities> {
  mapper: SQLMapperPluginInterface<T>

  // TODO mqemitter has no types
  mq?: any
  connectionString?: String
}

/**
 * Fastify plugin that add events capabilities to registered sql-mapper 
 */
export default function plugin<T extends Entities>(options: SQLEventsPluginOptions<T>): Promise<SQLEventsPluginInterface>

export function setupEmitter<T extends Entities>(options: SQLEventsPluginOptions<T>): void

import { Readable } from 'node:stream'
import { FastifyInstance } from 'fastify'
import { MQEmitter } from 'mqemitter'
import { SQLMapperPluginInterface, Entities } from '@platformatic/sql-mapper'
import { FastifyError } from '@fastify/error'

export interface SQLEventsPluginInterface {
  subscribe: (topic: string | string[]) => Promise<Readable>
}

export interface SQLEventsPluginOptions<T extends Entities> {
  mapper?: SQLMapperPluginInterface<T>
  mq?: MQEmitter
  connectionString?: string
}

/**
 * Fastify plugin that add events capabilities to registered sql-mapper
 */
export default function plugin<T extends Entities> (app: FastifyInstance, options: SQLEventsPluginOptions<T>): Promise<SQLEventsPluginInterface>

export function setupEmitter<T extends Entities> (options: SQLEventsPluginOptions<T>): void

/**
 * All the errors thrown by the plugin.
 */
export namespace errors {
  export const ObjectRequiredUnderTheDataProperty: () => FastifyError
  export const PrimaryKeyIsNecessaryInsideData: () => FastifyError
  export const NoSuchActionError: (action: string) => FastifyError
}

import { FastifyPluginAsync } from 'fastify'

export interface SQLEventsPluginOptions {
}

/**
 * Fastify plugin that add events capabilities to registered sql-mapper 
 */
declare const plugin: FastifyPluginAsync<SQLEventsPluginOptions>

export default plugin

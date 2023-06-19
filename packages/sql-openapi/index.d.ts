/// <reference types="@fastify/swagger" />
import { FastifyPluginAsync } from 'fastify'
import { OpenAPIV3 } from 'openapi-types'

export interface SQLOpenApiPluginOptions extends Partial<OpenAPIV3.Document> {
  /**
   * Set true to expose documentation route.
   */
  exposeRoute?: boolean
}

declare const plugin: FastifyPluginAsync<SQLOpenApiPluginOptions>
export default plugin

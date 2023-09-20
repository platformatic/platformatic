/// <reference types="@fastify/swagger" />
import { FastifyPluginAsync } from 'fastify'
import { OpenAPIV3 } from 'openapi-types'
import { FastifyError } from '@fastify/error'

export interface SQLOpenApiPluginOptions extends Partial<OpenAPIV3.Document> {
  /**
   * Set true to expose documentation route.
   */
  exposeRoute?: boolean,
  /**
   * Entity/field names to ignore when mapping to routes.
   */
  ignore?: {
    [entityName: string]: {
      [fieldName: string]: boolean
    } | boolean
  },
}


declare const plugin: FastifyPluginAsync<SQLOpenApiPluginOptions>
export default plugin

/**
 * All the errors thrown by the plugin.
 */
export module errors {
  export const UnableToCreateTheRouteForTheReverseRelationshipError: () => FastifyError
  export const UnableToCreateTheRouteForThePKColRelationshipError: () => FastifyError
}

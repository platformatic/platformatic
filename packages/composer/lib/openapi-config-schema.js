'use strict'

const ignoreSchema = {
  type: 'object',
  properties: {
    ignore: { type: 'boolean' }
  },
  additionalProperties: false
}

const aliasSchema = {
  type: 'object',
  properties: {
    alias: { type: 'string' }
  }
}

const jsonSchemaSchema = {
  $id: 'json-schema',
  type: 'object',
  properties: {
    type: { type: 'string' },
    properties: {
      type: 'object',
      additionalProperties: {
        oneOf: [
          { $ref: 'json-schema' },
          {
            type: 'object',
            properties: {
              rename: { type: 'string' }
            },
            additionalProperties: false
          }
        ]
      }
    },
    items: { $ref: 'json-schema' }
  },
  additionalProperties: false
}

const routeSchema = {
  anyOf: [
    ignoreSchema,
    {
      type: 'object',
      properties: {
        responses: {
          type: 'object',
          properties: {
            200: { $ref: 'json-schema' }
          }
        }
      }
    }
  ]
}

const openApiConfigSchema = {
  type: 'object',
  properties: {
    paths: {
      type: 'object',
      additionalProperties: {
        anyOf: [
          ignoreSchema,
          aliasSchema,
          {
            type: 'object',
            properties: {
              get: routeSchema,
              post: routeSchema,
              put: routeSchema,
              patch: routeSchema,
              delete: routeSchema,
              options: routeSchema,
              head: routeSchema,
              trace: routeSchema
            },
            additionalProperties: false
          }
        ]
      }
    }
  },
  additionalProperties: false,
  definitions: {
    'json-schema': jsonSchemaSchema
  }
}

module.exports = openApiConfigSchema

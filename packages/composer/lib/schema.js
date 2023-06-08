#! /usr/bin/env node
'use strict'

const { metrics, server, plugins, watch, clients, openApiBase, openApiDefs } = require('@platformatic/service').schema
const pkg = require('../package.json')
const version = 'v' + pkg.version

const composer = {
  type: 'object',
  properties: {
    services: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          origin: { type: 'string' },
          openapi: {
            type: 'object',
            properties: {
              url: { type: 'string' },
              file: { type: 'string', resolvePath: true },
              prefix: { type: 'string' },
              ignore: {
                type: 'array',
                items: {
                  oneOf: [
                    { type: 'string' },
                    {
                      type: 'object',
                      properties: {
                        path: { type: 'string' },
                        methods: {
                          type: 'array',
                          items: { type: 'string' },
                          minItems: 1
                        }
                      }
                    }
                  ]
                }
              }
            },
            anyOf: [
              { required: ['url'] },
              { required: ['file'] }
            ],
            additionalProperties: false
          },
          proxy: {
            oneOf: [
              { type: 'boolean', const: false },
              {
                type: 'object',
                properties: {
                  prefix: { type: 'string' }
                },
                required: ['prefix'],
                additionalProperties: false
              }
            ]
          }
        },
        required: ['id'],
        additionalProperties: false
      }
    },
    openapi: openApiBase,
    refreshTimeout: { type: 'integer', minimum: 1, default: 1000 }
  },
  required: ['services'],
  additionalProperties: false
}

const types = {
  type: 'object',
  properties: {
    autogenerate: {
      type: 'boolean'
    },
    dir: {
      description: 'The path to the directory the types should be generated in.',
      type: 'string',
      default: 'types',
      resolvePath: true
    }
  },
  additionalProperties: false
}

const platformaticComposerSchema = {
  $id: `https://platformatic.dev/schemas/${version}/composer`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    server,
    composer,
    metrics,
    types,
    plugins,
    clients,
    watch: {
      anyOf: [watch, {
        type: 'boolean'
      }]
    },
    $schema: {
      type: 'string'
    }
  },
  additionalProperties: false,
  required: ['composer', 'server'],
  $defs: openApiDefs
}

module.exports.schema = platformaticComposerSchema

/* c8 ignore next 3 */
if (require.main === module) {
  console.log(JSON.stringify(platformaticComposerSchema, null, 2))
}

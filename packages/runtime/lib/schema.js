#! /usr/bin/env node
'use strict'

const pkg = require('../package.json')
const version = 'v' + pkg.version
const platformaticRuntimeSchema = {
  $id: `https://platformatic.dev/schemas/${version}/runtime`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  properties: {
    autoload: {
      type: 'object',
      additionalProperties: false,
      required: ['path'],
      properties: {
        path: {
          type: 'string',
          resolvePath: true
        },
        exclude: {
          type: 'array',
          default: [],
          items: {
            type: 'string'
          }
        },
        mappings: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'config'],
            properties: {
              id: {
                type: 'string'
              },
              config: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    services: {
      type: 'array',
      default: [],
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'path', 'config'],
        properties: {
          id: {
            type: 'string'
          },
          path: {
            type: 'string',
            resolvePath: true
          },
          config: {
            type: 'string'
          }
        }
      }
    },
    entrypoint: {
      type: 'string'
    },
    hotReload: {
      type: 'boolean'
    },
    allowCycles: {
      type: 'boolean'
    },
    $schema: {
      type: 'string'
    }
  },
  anyOf: [
    { required: ['autoload', 'entrypoint'] },
    { required: ['services', 'entrypoint'] }
  ]
}

module.exports.schema = platformaticRuntimeSchema

if (require.main === module) {
  console.log(JSON.stringify(platformaticRuntimeSchema, null, 2))
}

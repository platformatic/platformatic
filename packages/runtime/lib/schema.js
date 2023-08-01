#! /usr/bin/env node
'use strict'

const telemetry = require('@platformatic/telemetry').schema
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
    telemetry,
    services: {
      type: 'array',
      default: [],
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
      anyOf: [
        {
          type: 'boolean'
        },
        {
          type: 'string'
        }
      ]
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

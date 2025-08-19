import { schemaComponents as basicSchemaComponents } from '@platformatic/basic'
import { schemaComponents as utilsSchemaComponents } from '@platformatic/foundation'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'))
export const version = packageJson.version

const vite = {
  type: 'object',
  properties: {
    configFile: {
      oneOf: [{ type: 'string' }, { type: 'boolean' }]
    },
    devServer: {
      type: 'object',
      properties: {
        strict: {
          type: 'boolean',
          // This required to avoid showing error users when the node_modules
          // for vite or similar are in some nested parent folders
          default: false
        }
      },
      additionalProperties: false,
      default: {}
    },
    ssr: {
      oneOf: [
        {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            entrypoint: { type: 'string', default: 'server.js' },
            clientDirectory: { type: 'string', default: 'client' },
            serverDirectory: { type: 'string', default: 'server' }
          },
          required: ['entrypoint'],
          additionalProperties: false
        },
        { type: 'boolean' }
      ],
      default: false
    }
  },
  default: {},
  additionalProperties: false
}

export const schemaComponents = { vite }

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/vite/${packageJson.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Vite Config',
  type: 'object',
  properties: {
    $schema: {
      type: 'string'
    },
    logger: utilsSchemaComponents.logger,
    server: utilsSchemaComponents.server,
    watch: basicSchemaComponents.watch,
    application: basicSchemaComponents.buildableApplication,
    runtime: utilsSchemaComponents.wrappedRuntime,
    vite,
    on404: {
      oneOf: [
        {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            path: { type: 'string', default: 'index.html' }
          },
          required: ['path'],
          additionalProperties: false
        },
        { type: 'string' },
        { type: 'boolean' }
      ],
      default: false
    }
  },
  additionalProperties: false
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}

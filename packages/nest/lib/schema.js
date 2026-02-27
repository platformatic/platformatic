import { schemaComponents as basicSchemaComponents } from '@platformatic/basic'
import { parsePackageJSON, schemaComponents as utilsSchemaComponents } from '@platformatic/foundation'

export const packageJson = parsePackageJSON(import.meta.dirname)
export const version = packageJson.version

const nest = {
  type: 'object',
  properties: {
    adapter: {
      type: 'string',
      enum: ['express', 'fastify'],
      // We would probably prefer 'fastify' as default, but NestJS uses express by default so we don't want to break existing setups
      default: 'express'
    },
    appModule: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          default: 'app.module'
        },
        name: {
          type: 'string',
          default: 'AppModule'
        }
      },
      additionalProperties: false,
      default: {}
    },
    setup: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          default: ''
        },
        name: {
          type: 'string'
        }
      },
      additionalProperties: false,
      default: {}
    }
  },
  default: {},
  additionalProperties: false
}

export const schemaComponents = { nest }

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/nest/${version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic NestJS Config',
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
    nest
  },
  additionalProperties: false
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}

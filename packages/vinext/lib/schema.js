import { schemaComponents as basicSchemaComponents } from '@platformatic/basic'
import { parsePackageJSON, schemaComponents as utilsSchemaComponents } from '@platformatic/foundation'
import { schemaComponents as nextSchemaComponents } from '@platformatic/next'

export const packageJson = parsePackageJSON(import.meta.dirname)
export const version = packageJson.version

export const vinext = {
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
    noCompression: {
      type: 'boolean',
      default: false
    }
  },
  default: {},
  additionalProperties: false
}

export const schemaComponents = { vinext }

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/vinext/${packageJson.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Vinext Config',
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
    vinext,
    cache: nextSchemaComponents.cache
  },
  additionalProperties: false
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}

import { schemaComponents as utilsSchemaComponents } from '@platformatic/utils'
import { readFileSync } from 'node:fs'

export const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))
export const version = packageJson.version

const application = {
  type: 'object',
  properties: {
    basePath: {
      type: 'string'
    },
    outputDirectory: {
      type: 'string',
      default: 'dist'
    },
    include: {
      type: 'array',
      items: {
        type: 'string'
      },
      default: ['dist']
    },
    commands: {
      type: 'object',
      properties: {
        install: {
          type: 'string',
          default: 'npm ci --omit-dev'
        },
        // All the following options purposely don't have a default so
        // that stackables can detect if the user explicitly set them.
        build: {
          type: 'string'
        },
        development: {
          type: 'string'
        },
        production: {
          type: 'string'
        }
      },
      default: {},
      additionalProperties: false
    }
  },
  additionalProperties: false,
  default: {}
}

const watch = {
  anyOf: [
    utilsSchemaComponents.watch,
    {
      type: 'boolean'
    },
    {
      type: 'string'
    }
  ]
}

export const schemaComponents = { application, watch }

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/basic/${packageJson.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Basic Config',
  type: 'object',
  properties: {
    $schema: {
      type: 'string'
    },
    runtime: utilsSchemaComponents.wrappedRuntime
  },
  additionalProperties: true
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}

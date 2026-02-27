import { parsePackageJSON, schemaComponents as utilsSchemaComponents } from '@platformatic/foundation'

export const packageJson = parsePackageJSON(import.meta.dirname)
export const version = packageJson.version

// This is used by applications to have common properties.
const application = {
  type: 'object',
  properties: {},
  additionalProperties: false,
  required: [],
  default: {}
}

/*
  For legacy purposes, when an application is buildable (like Astro), it should use for the application properties.
  Make sure this always extends the `application` schema above.
*/

const buildableApplication = {
  type: 'object',
  properties: {
    ...application.properties,
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
        // that capabilities can detect if the user explicitly set them.
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
  required: [...application.required],
  default: {
    ...application.default
  }
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

export const schemaComponents = { application, buildableApplication, watch }

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

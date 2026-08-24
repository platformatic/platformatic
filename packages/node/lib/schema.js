import { schemaComponents as basicSchemaComponents } from '@platformatic/basic/lib/schema.js'
import { schemaComponents as utilsSchemaComponents } from '@platformatic/foundation/lib/schema.js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'))
export const version = packageJson.version

// Classified by the started worker: two of #hasServer()'s three inputs — the module's own
// hasServer export and isBackgroundApplication on the factory's result — are known only once
// the application's code has been imported and its factory called.
export const servesWithoutPort = 'worker'

const node = {
  type: 'object',
  properties: {
    main: {
      type: 'string'
    },
    absoluteUrl: {
      description: 'This Node.js application requires the Absolute URL from the Gateway',
      type: 'boolean',
      default: false
    },
    dispatchViaHttp: {
      type: 'boolean',
      default: false
    },
    disablePlatformaticInBuild: {
      type: 'boolean',
      default: false
    },
    disableBuildInDevelopment: {
      type: 'boolean',
      default: false
    },
    hasServer: {
      type: 'boolean',
      default: true
    }
  },
  default: {},
  additionalProperties: false
}

export const schemaComponents = { node }

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/node/${version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Node.js Config',
  type: 'object',
  properties: {
    $schema: {
      type: 'string'
    },
    module: {
      type: 'string'
    },
    logger: utilsSchemaComponents.logger,
    server: utilsSchemaComponents.server,
    watch: basicSchemaComponents.watch,
    application: basicSchemaComponents.buildableApplication,
    runtime: utilsSchemaComponents.wrappedRuntime,
    node
  },
  additionalProperties: false
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}

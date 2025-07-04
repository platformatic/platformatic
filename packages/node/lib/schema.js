import { schemaComponents as basicSchemaComponents } from '@platformatic/basic'
import { schemaComponents as utilsSchemaComponents } from '@platformatic/utils'
import { readFileSync } from 'node:fs'

export const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))

export const version = packageJson.version

const node = {
  type: 'object',
  properties: {
    main: {
      type: 'string'
    },
    absoluteUrl: {
      description: 'This Node.js application requires the Absolute URL from the Composer',
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
    logger: utilsSchemaComponents.logger,
    server: utilsSchemaComponents.server,
    watch: basicSchemaComponents.watch,
    application: basicSchemaComponents.application,
    runtime: utilsSchemaComponents.wrappedRuntime,
    node
  },
  additionalProperties: false
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}

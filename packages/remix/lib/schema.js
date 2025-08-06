import { schemaComponents as basicSchemaComponents } from '@platformatic/basic'
import { schemaComponents as utilsSchemaComponents } from '@platformatic/foundation'
import { schemaComponents as viteSchemaComponents } from '@platformatic/vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'))
export const version = packageJson.version

export const remix = {
  type: 'object',
  properties: {
    outputDirectory: {
      type: 'string',
      default: 'build'
    }
  },
  default: {},
  additionalProperties: false
}

export const schemaComponents = { remix }

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/remix/${packageJson.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Remix Config',
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
    vite: viteSchemaComponents.vite,
    remix
  },
  additionalProperties: false
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}

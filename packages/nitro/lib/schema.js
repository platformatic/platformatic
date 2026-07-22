import { schemaComponents as basicSchemaComponents } from '@platformatic/basic'
import { schemaComponents as utilsSchemaComponents } from '@platformatic/foundation'
import { schemaComponents as viteSchemaComponents } from '@platformatic/vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'))
export const version = packageJson.version

export const nitro = {
  type: 'object',
  properties: {
    outputDirectory: {
      type: 'string'
    },
    entrypoint: {
      type: 'string',
      default: 'server/index.mjs'
    }
  },
  default: {},
  additionalProperties: false
}

const application = structuredClone(basicSchemaComponents.buildableApplication)
application.properties.outputDirectory.default = '.output'
delete application.properties.include.default

const server = structuredClone(utilsSchemaComponents.server)
delete server.properties.http2

const vite = structuredClone(viteSchemaComponents.vite)
delete vite.properties.ssr
delete vite.properties.notFoundHandler

export const schemaComponents = { nitro, vite }

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/nitro/${packageJson.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Nitro Config',
  type: 'object',
  properties: {
    $schema: { type: 'string' },
    module: { type: 'string' },
    logger: utilsSchemaComponents.logger,
    server,
    watch: basicSchemaComponents.watch,
    application,
    runtime: utilsSchemaComponents.wrappedRuntime,
    vite,
    nitro
  },
  additionalProperties: false
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}

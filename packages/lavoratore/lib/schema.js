import { schemaComponents as basicSchemaComponents } from '@platformatic/basic'
import { schemaComponents as utilsSchemaComponents } from '@platformatic/foundation'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'))
export const version = packageJson.version

export const lavoratore = {
  type: 'object',
  properties: {
    configFile: {
      description: 'The Wrangler configuration file. Defaults to wrangler.json, wrangler.jsonc or wrangler.toml.',
      type: 'string'
    },
    environment: {
      description: 'The Wrangler environment to use.',
      type: 'string'
    },
    main: {
      description:
        'The Worker entrypoint. Overrides the "main" property of the Wrangler configuration file. When missing in both, it is autodetected.',
      type: 'string'
    },
    vars: {
      description: 'Additional environment variables exposed to the Worker via the env object.',
      type: 'object',
      additionalProperties: { type: 'string' }
    },
    services: {
      description:
        'Service bindings, mapping the binding name to the ID of a Watt application. Merged with the "services" property of the Wrangler configuration file.',
      type: 'object',
      additionalProperties: { type: 'string' }
    },
    crons: {
      description: 'Cron triggers. Overrides the "triggers.crons" property of the Wrangler configuration file.',
      type: 'array',
      items: { type: 'string' }
    }
  },
  default: {},
  additionalProperties: false
}

const server = structuredClone(utilsSchemaComponents.server)
delete server.properties.http2

export const schemaComponents = { lavoratore }

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/lavoratore/${version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic Lavoratore Config',
  type: 'object',
  properties: {
    $schema: {
      type: 'string'
    },
    module: {
      type: 'string'
    },
    logger: utilsSchemaComponents.logger,
    server,
    watch: basicSchemaComponents.watch,
    application: basicSchemaComponents.buildableApplication,
    runtime: utilsSchemaComponents.wrappedRuntime,
    lavoratore
  },
  additionalProperties: false
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}

import { schemaComponents as basicSchemaComponents } from '@platformatic/basic/lib/schema.js'
import { schemaComponents as utilsSchemaComponents } from '@platformatic/foundation/lib/schema.js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8'))
export const version = packageJson.version

/*
  The package ships two capability classes and the configuration decides which one runs:
  create() selects ViteSSRCapability when SSR is enabled and ViteCapability otherwise, and
  ViteSSRCapability extends NodeCapability — so an SSR application inherits Node's uncertainty
  exactly. A single per-package answer would reject a valid no-port SSR factory under dev and
  promise a mesh URL under start for a module that reports no server.

  The callable receives the configuration as authored and validated, never as transformed: this is
  read main-side, while the capability transform runs worker-side and later. The schema admits
  ssr as either a boolean or an object, and only transform normalizes the boolean to the object
  form — so testing ssr?.enabled alone reads undefined for the supported vite({ ssr: true })
  spelling and classifies an SSR application as ordinary Vite.
*/
export const servesWithoutPort = config => {
  const ssr = config?.vite?.ssr

  return ssr === true || ssr?.enabled ? 'worker' : { development: false, production: true }
}

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
      anyOf: [
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
    },
    notFoundHandler: {
      anyOf: [
        { type: 'boolean' },
        { type: 'string' },
        {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            path: { type: 'string', default: 'index.html' },
            contentType: { type: 'string', default: 'text/html; charset=utf-8' },
            statusCode: { type: 'number', default: 200 }
          },
          additionalProperties: false
        }
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
    module: {
      type: 'string'
    },
    logger: utilsSchemaComponents.logger,
    server: utilsSchemaComponents.server,
    watch: basicSchemaComponents.watch,
    application: basicSchemaComponents.buildableApplication,
    runtime: utilsSchemaComponents.wrappedRuntime,
    vite
  },
  additionalProperties: false
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}

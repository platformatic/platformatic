import { schemaComponents as basicSchemaComponents } from '@platformatic/basic'
import { parsePackageJSON, schemaComponents as utilsSchemaComponents } from '@platformatic/foundation'
import { schemaComponents as viteSchemaComponents } from '@platformatic/vite'

export const packageJson = parsePackageJSON(import.meta.dirname)
export const version = packageJson.version

export const schemaComponents = {}

export const schema = {
  $id: `https://schemas.platformatic.dev/@platformatic/tanstack/${packageJson.version}.json`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic TanStack Config',
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
    vite: viteSchemaComponents.vite
  },
  additionalProperties: false
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}

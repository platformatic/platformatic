import { parsePackageJSON } from '@platformatic/foundation'
import { schema as runtimeSchema } from '@platformatic/runtime'

const packageJson = parsePackageJSON(import.meta.dirname)

export const version = packageJson.version

export const schema = {
  ...runtimeSchema,
  $id: `https://schemas.platformatic.dev/wattpm/${packageJson.version}.json`
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}

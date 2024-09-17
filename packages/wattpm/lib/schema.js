import { schema as runtimeSchema } from '@platformatic/runtime'
import { readFile } from 'node:fs/promises'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url)))

export const version = pkg.version

// TODO@mcollina: This will be changed once watt.pm is online
export const schema = {
  ...runtimeSchema,
  $id: `https://schemas.platformatic.dev/@platformatic/wattpm/${pkg.version}.json`
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}

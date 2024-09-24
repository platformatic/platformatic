import { schema as runtimeSchema } from '@platformatic/runtime'
import { readFile } from 'node:fs/promises'

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf-8'))

export const version = pkg.version

export const schema = {
  ...runtimeSchema,
  $id: `https://schemas.platformatic.dev/wattpm/${pkg.version}.json`
}

/* c8 ignore next 3 */
if (process.argv[1] === import.meta.filename) {
  console.log(JSON.stringify(schema, null, 2))
}

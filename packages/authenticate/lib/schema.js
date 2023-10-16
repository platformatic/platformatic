import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)))
const version = 'v' + pkg.version

const loginSchema = {
  $id: `https://platformatic.dev/schemas/${version}/login`,
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Platformatic authorization config schema',
  type: 'object',
  properties: {
    $schema: { type: 'string' },
    userApiKey: { type: 'string' }
  },
  required: ['userApiKey'],
  additionalProperties: false
}

export default loginSchema

/* c8 ignore next 3 */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(loginSchema, null, 2))
}

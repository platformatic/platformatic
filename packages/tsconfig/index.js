import JSON5 from 'json5'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const config = JSON5.parse(readFileSync(resolve(import.meta.dirname, 'tsconfig.json'), 'utf8'))
export default config

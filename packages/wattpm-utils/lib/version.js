import { parsePackageJSON } from '@platformatic/foundation'

const packageJson = parsePackageJSON(import.meta.dirname)

export const name = packageJson.name
export const version = packageJson.version

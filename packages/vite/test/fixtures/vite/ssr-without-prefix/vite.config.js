import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const path = fileURLToPath(import.meta.url)
const root = resolve(dirname(path), 'client')

export default { root, logLevel: globalThis.platformatic.logger.level }

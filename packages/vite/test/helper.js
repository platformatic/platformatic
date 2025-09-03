import { cp } from 'node:fs/promises'
import { resolve } from 'node:path'

export function copyServerEntrypoint (root) {
  return cp(resolve(import.meta.dirname, './fixtures/ssr-server.js'), resolve(root, 'services/frontend/server.js'))
}

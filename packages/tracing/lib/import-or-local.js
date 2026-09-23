import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export async function importOrLocal ({ projectDir, pkg }) {
  try {
    return import(pkg)
  } catch (err) {
    const pkgJsonPath = join(projectDir, 'package.json')
    const _require = createRequire(pkgJsonPath)
    const fileToImport = _require.resolve(pkg)
    return import(pathToFileURL(fileToImport))
  }
}

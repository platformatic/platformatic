import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

export async function swapVersion (t, root, pkg, packageJsonRelativePath = '.') {
  const require = createRequire(root)
  const pkgRoot = dirname(require.resolve(pkg))
  const packageJson = resolve(pkgRoot, packageJsonRelativePath, 'package.json')

  const originalContents = await readFile(packageJson, 'utf-8')
  const newContents = JSON.parse(originalContents)

  newContents.version = '1.0.0'
  await writeFile(packageJson, JSON.stringify(newContents))
  t.after(() => writeFile(packageJson, originalContents))
}

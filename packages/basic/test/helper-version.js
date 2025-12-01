import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function swapVersion (t, root, pkg, packageJsonRelativePath = '.', newVersion = '1.0.0') {
  const pkgRoot = dirname(fileURLToPath(import.meta.resolve(pkg)))
  const packageJson = resolve(pkgRoot, packageJsonRelativePath, 'package.json')

  const originalContents = await readFile(packageJson, 'utf-8')
  const newContents = JSON.parse(originalContents)

  newContents.version = newVersion
  await writeFile(packageJson, JSON.stringify(newContents))
  t.after(() => writeFile(packageJson, originalContents))
}

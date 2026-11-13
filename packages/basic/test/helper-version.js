import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export async function swapVersion (t, root, pkg, _packageJsonRelativePath, newVersion = '1.0.0') {
  // Resolve the package.json directly using the package's exports
  const packageJson = fileURLToPath(import.meta.resolve(`${pkg}/package.json`))

  const originalContents = await readFile(packageJson, 'utf-8')
  const newContents = JSON.parse(originalContents)

  newContents.version = newVersion
  await writeFile(packageJson, JSON.stringify(newContents))
  t.after(() => writeFile(packageJson, originalContents))
}

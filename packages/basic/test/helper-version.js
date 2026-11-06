import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Computed at load time since tests change the working directory
const testDepsRoot = resolve(process.cwd(), 'test/deps/node_modules')

export async function swapVersion (t, root, pkg, _packageJsonRelativePath, newVersion = '1.0.0') {
  // Resolve the package.json directly using the package's exports
  // Packages installed by install-deps.js (test/deps) take precedence over the workspace ones
  const installed = resolve(testDepsRoot, pkg, 'package.json')
  const packageJson = existsSync(installed) ? installed : fileURLToPath(import.meta.resolve(`${pkg}/package.json`))

  const originalContents = await readFile(packageJson, 'utf-8')
  const newContents = JSON.parse(originalContents)

  newContents.version = newVersion
  await writeFile(packageJson, JSON.stringify(newContents))
  t.after(() => writeFile(packageJson, originalContents))
}

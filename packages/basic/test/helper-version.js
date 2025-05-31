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

export async function setLogFile (t, root) {
  const originalEnv = process.env.PLT_RUNTIME_LOGGER_STDOUT
  process.env.PLT_RUNTIME_LOGGER_STDOUT = resolve(root, 'log.txt')

  t.after(() => {
    process.env.PLT_RUNTIME_LOGGER_STDOUT = originalEnv
  })
}

export async function getLogs (root) {
  return (await readFile(resolve(root, 'log.txt'), 'utf-8')).split('\n').filter(Boolean).map(JSON.parse)
}

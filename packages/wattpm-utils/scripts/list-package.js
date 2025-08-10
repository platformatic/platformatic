import { loadConfigurationFile } from '@platformatic/foundation'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packages = []

const packagesDir = fileURLToPath(new URL('../..', import.meta.url))
for (const path of await readdir(packagesDir)) {
  const packageJsonPath = resolve(packagesDir, path, 'package.json')

  if (existsSync(packageJsonPath)) {
    const packageJson = await loadConfigurationFile(packageJsonPath)
    packages.push(packageJson.name)
  }
}

console.log('// This is auto generated from "npm run gen-packages" - DO NOT EDIT')
console.log(`export const packages = ${JSON.stringify(packages.sort(), null, 2).replaceAll('"', "'")}`)

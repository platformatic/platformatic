// Installs the dependencies listed in `test/deps/package.json` of the package it is run from
// (the current working directory) into `test/deps/node_modules`. They are kept out of the
// workspace so that old, vulnerable framework versions do not end up in the monorepo lockfile.
// `ensureDependencies` in helper.js prefers them over the workspace ones.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const depsRoot = resolve(process.cwd(), 'test/deps')
const manifest = readFileSync(resolve(depsRoot, 'package.json'), 'utf-8')
const stamp = resolve(depsRoot, 'node_modules/.installed.json')

if (existsSync(stamp) && readFileSync(stamp, 'utf-8') === manifest) {
  process.exit(0)
}

const result = spawnSync(
  'npm',
  ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-package-lock', '--legacy-peer-deps'],
  { cwd: depsRoot, stdio: 'inherit', shell: process.platform === 'win32' }
)

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

writeFileSync(stamp, manifest)

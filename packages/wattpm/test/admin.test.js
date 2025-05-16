import { isWindows, temporaryFolder } from '@platformatic/basic/test/helper.js'
import { createDirectory, safeRemove } from '@platformatic/utils'
import { deepStrictEqual } from 'node:assert'
import { chmod, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { wattpm } from './helper.js'

// This test cannot be run in Windows as it's pretty hard to mock the executable.
// Anyway given we're just checking what is passed to (p)npx, it should be fine to skip.

const content = `#!/bin/sh
echo "$executable $@" > $PWD/cmdline
`

async function prepareSpawner (t) {
  const repo = resolve(temporaryFolder, 'repo-' + Date.now())
  await createDirectory(repo)
  t.after(() => safeRemove(repo))

  await writeFile(resolve(repo, 'pnpx'), content.replace('$executable', 'pnpx'), 'utf8')
  await writeFile(resolve(repo, 'npx'), content.replace('$executable', 'npx'), 'utf8')
  await chmod(resolve(repo, 'pnpx'), 0o755)
  await chmod(resolve(repo, 'npx'), 0o755)

  return repo
}

test('admin should run watt-admin with npx by default', { skip: isWindows }, async (t) => {
  const root = await prepareSpawner(t)
  await wattpm('admin', { cwd: root, env: { PATH: root } })

  const output = await readFile(resolve(root, 'cmdline'), 'utf8')
  deepStrictEqual(output.trim(), 'npx -y @platformatic/watt-admin')
})

test('admin should autodetect the package manager', { skip: isWindows }, async (t) => {
  const root = await prepareSpawner(t)
  await writeFile(resolve(root, 'pnpm-lock.yaml'), '--', 'utf8')
  await wattpm('admin', '-l', { cwd: root, env: { PATH: root } })

  const output = await readFile(resolve(root, 'cmdline'), 'utf8')
  deepStrictEqual(output.trim(), 'pnpx @platformatic/watt-admin@latest')
})

test('admin should allow to specify the package manager explictly', { skip: isWindows }, async (t) => {
  const root = await prepareSpawner(t)
  await wattpm('admin', '-P', 'pnpm', { cwd: root, env: { PATH: root } })

  const output = await readFile(resolve(root, 'cmdline'), 'utf8')
  deepStrictEqual(output.trim(), 'pnpx @platformatic/watt-admin')
})

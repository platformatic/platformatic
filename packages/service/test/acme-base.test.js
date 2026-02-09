import { execa } from 'execa'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

test('capability example', async t => {
  const cwd = join(import.meta.dirname, './fixtures/acme-base')
  await execa('node', ['--test'], { cwd })
})

test('capability in typescript', async t => {
  const cwd = join(import.meta.dirname, './fixtures/acme-base-ts')

  let tscPath = join(import.meta.dirname, '..', 'node_modules', '.bin', 'tsc')
  // If the local npm installation should use global tsc in the root
  if (!existsSync(tscPath)) {
    tscPath = join(import.meta.dirname, '../../..', 'node_modules', '.bin', 'tsc')
  }

  await execa(tscPath, { cwd, stdio: 'inherit' })
  await execa('node', ['--test'], { cwd: join(cwd, 'dist') })
})

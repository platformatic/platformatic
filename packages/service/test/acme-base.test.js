import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

test('stackable example', async t => {
  const cwd = join(import.meta.dirname, './fixtures/acme-base')
  const { execa } = await import('execa')
  await execa('node', ['--test'], { cwd })
})

test('stackable in typescript', async t => {
  const cwd = join(import.meta.dirname, './fixtures/acme-base-ts')
  const { execa } = await import('execa')

  let tscPath = join(import.meta.dirname, '..', 'node_modules', '.bin', 'tsc')
  // If the local npm installation should use global tsc in the root
  if (!existsSync(tscPath)) {
    tscPath = join(import.meta.dirname, '../../..', 'node_modules', '.bin', 'tsc')
  }

  await execa(tscPath, { cwd, stdio: 'inherit' })
  await execa('node', ['--test'], { cwd: join(cwd, 'dist') })
})

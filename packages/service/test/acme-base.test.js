'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { existsSync } = require('node:fs')

test('stackable example', async t => {
  const { execa } = await import('execa')

  // if this fails, it will throw an error
  await execa('node', ['--test'], {
    cwd: join(__dirname, '..', 'fixtures', 'acme-base'),
  })

  const tsd = (await import('tsd')).default

  const diagnostics = await tsd.default()
  assert.strictEqual(diagnostics.length, 0, 'no type errors')
})

test('stackable in typescript', async t => {
  const { execa } = await import('execa')

  const cwd = join(__dirname, '..', 'fixtures', 'acme-base-ts')

  let tscPath = join(__dirname, '..', 'node_modules', '.bin', 'tsc')

  // If the local npm installation should use global tsc in the root
  if (!existsSync(tscPath)) {
    tscPath = join(__dirname, '../../..', 'node_modules', '.bin', 'tsc')
  }

  await execa(tscPath, { cwd, stdio: 'inherit' })

  // if this fails, it will throw an error
  await execa('node', ['--test'], {
    cwd: join(cwd, 'dist'),
  })
})

'use strict'

const { test } = require('node:test')
const { join } = require('node:path')
const { existsSync } = require('node:fs')

test('stackable example', async t => {
  const cwd = join(__dirname, './fixtures/acme-base')
  const { execa } = await import('execa')
  await execa('node', ['--test'], { cwd })
})

test('stackable in typescript', async t => {
  const cwd = join(__dirname, './fixtures/acme-base-ts')
  const { execa } = await import('execa')

  let tscPath = join(__dirname, '..', 'node_modules', '.bin', 'tsc')
  // If the local npm installation should use global tsc in the root
  if (!existsSync(tscPath)) {
    tscPath = join(__dirname, '../../..', 'node_modules', '.bin', 'tsc')
  }

  await execa(tscPath, { cwd, stdio: 'inherit' })
  await execa('node', ['--test'], { cwd: join(cwd, 'dist') })
})

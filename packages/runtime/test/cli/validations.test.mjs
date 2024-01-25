import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { stripVTControlCharacters } from 'node:util'
import { join } from 'desm'
import { execa } from 'execa'
import { cliPath } from './helper.mjs'

const version = JSON.parse(await readFile(join(import.meta.url, '..', '..', 'package.json'))).version

test('version', async () => {
  const { stdout } = await execa(process.execPath, [cliPath, '--version'])

  assert.strictEqual(stdout.trim(), `v${version}`)
})

test('missing config', async () => {
  await assert.rejects(execa(process.execPath, [cliPath, 'start']))
})

test('no services specified by config', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'configs', 'no-services.config.json')

  await assert.rejects(execa(process.execPath, [cliPath, 'start', '--config', config]))
})

test('no services or autoload specified by config', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'configs', 'no-sources.config.json')

  await assert.rejects(execa(process.execPath, [cliPath, 'start', '--config', config]))
})

test('print validation errors', async () => {
  let error

  try {
    const config = join(import.meta.url, '..', '..', 'fixtures', 'configs', 'missing-property.config.json')

    await execa(process.execPath, [cliPath, 'start', '--config', config])
  } catch (err) {
    error = err
  }

  assert(error)
  assert.strictEqual(error.exitCode, 1)
  assert.strictEqual(stripVTControlCharacters(error.stdout).includes('`must have required property \'path\' {"missingProperty":"path"}`'), true)
  assert.strictEqual(stripVTControlCharacters(error.stdout).includes('/autoload'), true)
})

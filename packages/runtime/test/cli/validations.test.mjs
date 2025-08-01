import { execa } from 'execa'
import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { stripVTControlCharacters } from 'node:util'
import { startPath } from './helper.mjs'

test('missing config', async () => {
  await assert.rejects(execa(process.execPath, [startPath]))
})

test('no services specified by config', async () => {
  const config = join(import.meta.dirname, '..', '..', 'fixtures', 'configs', 'no-services.config.json')

  await assert.rejects(execa(process.execPath, [startPath, config]))
})

test('no services or autoload specified by config', async () => {
  const config = join(import.meta.dirname, '..', '..', 'fixtures', 'configs', 'no-sources.config.json')

  await assert.rejects(execa(process.execPath, [startPath, config]))
})

test('print validation errors', async () => {
  let error

  try {
    const config = join(import.meta.dirname, '..', '..', 'fixtures', 'configs', 'missing-property.config.json')

    await execa(process.execPath, [startPath, config])
  } catch (err) {
    error = err
  }

  assert(error)
  assert.strictEqual(error.exitCode, 1)
  assert.strictEqual(
    stripVTControlCharacters(error.stderr).includes("/autoload: must have required property 'path'"),
    true
  )
})

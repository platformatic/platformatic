import assert from 'node:assert'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { isFileAccessible } from '../lib/utils.js'

test('isFileAccessible with dir', async t => {
  const dir = resolve(join(import.meta.dirname, '.', 'fixtures', 'hello'))
  assert.strictEqual(await isFileAccessible('watt.config.js', dir), true)
})

test('isFileAccessible no dir', async t => {
  const file = resolve(join(import.meta.dirname, '.', 'fixtures', 'hello', 'watt.config.js'))
  assert.strictEqual(await isFileAccessible(file), true)
})

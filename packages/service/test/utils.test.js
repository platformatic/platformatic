import assert from 'node:assert'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import { isFileAccessible } from '../lib/utils.js'

test('isFileAccessible with dir', async t => {
  const dir = resolve(join(import.meta.dirname, '.', 'fixtures', 'hello'))
  assert.strictEqual(await isFileAccessible('platformatic.service.json', dir), true)
})

test('isFileAccessible no dir', async t => {
  const file = resolve(join(import.meta.dirname, '.', 'fixtures', 'hello', 'platformatic.service.json'))
  assert.strictEqual(await isFileAccessible(file), true)
})

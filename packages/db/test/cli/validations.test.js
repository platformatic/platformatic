import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { create } from '../../index.js'
import { getConnectionInfo } from '../helper.js'

test('missing config', async t => {
  await assert.rejects(async () => {
    await create(undefined)
  })
})

test('print validation errors', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  t.after(async () => {
    await dropTestDB()
  })

  process.env.DATABASE_URL = connectionInfo.connectionString

  try {
    await create(join(import.meta.dirname, '..', 'fixtures', 'missing-required-values.json'))
    assert.fail('should have thrown')
  } catch (err) {
    assert.ok(err.message.includes("must have required property 'dir'"))
  }
})

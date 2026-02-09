import { kMetadata } from '@platformatic/foundation'
import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { create } from '../../index.js'

test('get application info via capability api', async t => {
  const projectRoot = join(import.meta.dirname, '..', 'fixtures', 'sqlite-basic')
  const config = join(projectRoot, 'platformatic.db.json')

  process.env.DATABASE_URL = 'sqlite://:memory:'
  const capability = await create(projectRoot, config)
  t.after(async () => {
    await capability.stop()
  })
  await capability.start({ listen: true })

  assert.strictEqual(capability.getApplication().platformatic.config[kMetadata].root, projectRoot)
})

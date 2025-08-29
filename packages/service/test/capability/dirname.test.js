import { kMetadata } from '@platformatic/foundation'
import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { create } from '../../index.js'

test('get service info via capability api', async t => {
  const projectRoot = join(import.meta.dirname, '..', 'fixtures', 'directories')

  const capability = await create(projectRoot)
  t.after(() => capability.stop())
  await capability.start({ listen: true })

  assert.strictEqual(capability.getApplication().platformatic.config[kMetadata].root, projectRoot)
})

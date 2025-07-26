import { kMetadata } from '@platformatic/utils'
import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { create } from '../../index.js'

test('get service info via stackable api', async t => {
  const projectRoot = join(import.meta.dirname, '..', 'fixtures', 'directories')

  const stackable = await create(projectRoot)
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  assert.strictEqual(stackable.getApplication().platformatic.config[kMetadata].root, projectRoot)
})

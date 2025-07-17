import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { create, version } from '../../index.js'

test('get service info via stackable api', async t => {
  const stackable = await create(join(import.meta.dirname, '..', 'fixtures', 'directories'))
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  const stackableInfo = await stackable.getInfo()
  assert.deepStrictEqual(stackableInfo, { type: 'service', version })
})

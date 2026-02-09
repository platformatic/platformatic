import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { create, version } from '../../index.js'

test('get service info via capability api', async t => {
  const capability = await create(join(import.meta.dirname, '..', 'fixtures', 'directories'))
  t.after(() => capability.stop())
  await capability.start({ listen: true })

  const capabilityInfo = await capability.getInfo()
  assert.deepStrictEqual(capabilityInfo, { dependencies: [], type: 'service', version })
})

import { deepEqual, equal, ok } from 'node:assert/strict'
import { test } from 'node:test'
import { getArrayDifference } from '../lib/utils.js'
import { getMemoryInfo } from '../lib/metrics.js'

test('getArrayDifference', async t => {
  const a = [1, 2, 3]
  const b = [2, 3, 4]

  deepEqual(getArrayDifference(a, b), [1])
  deepEqual(getArrayDifference(b, a), [4])
})

test('getMemoryInfo - should get the host memory info', async t => {
  const memInfo = await getMemoryInfo()
  equal(memInfo.scope, 'host')
  ok(memInfo.used > 0)
  ok(memInfo.total > 0)
  ok(memInfo.used <= memInfo.total)
})

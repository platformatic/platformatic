import { deepEqual } from 'node:assert'
import { test } from 'node:test'
import { getArrayDifference } from '../lib/utils.js'

test('getArrayDifference', async t => {
  const a = [1, 2, 3]
  const b = [2, 3, 4]

  deepEqual(getArrayDifference(a, b), [1])
  deepEqual(getArrayDifference(b, a), [4])
})

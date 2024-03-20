'use strict'
const { describe, test } = require('node:test')
const assert = require('node:assert')
const { getArrayDifference } = require('../lib/utils')

describe('utils', () => {
  test('getArrayDifference', async (t) => {
    const a = [1, 2, 3]
    const b = [2, 3, 4]

    assert.deepEqual(getArrayDifference(a, b), [1])
    assert.deepEqual(getArrayDifference(b, a), [4])
  })
})

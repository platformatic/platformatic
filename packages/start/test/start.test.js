'use strict'
const assert = require('node:assert')
const { test } = require('node:test')
const { unifiedApi } = require('@platformatic/runtime')
const start = require('..')

test('re-exports the unified api from @platformatic/runtime', () => {
  // The API's functionality is tested in the runtime package.
  assert.deepStrictEqual(start, unifiedApi)
})

import { deepStrictEqual } from 'node:assert'
import { test } from 'node:test'
import { getGlobal } from '../lib/index.js'

test('getGlobal should return the global object', t => {
  globalThis.platformatic = 'platformatic'
  deepStrictEqual(getGlobal(), 'platformatic')

  globalThis.platformatic = 'platformatic2'
})

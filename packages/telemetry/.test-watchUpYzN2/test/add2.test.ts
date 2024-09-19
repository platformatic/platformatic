import { test } from 'node:test'
import { add } from '../src/add.js'
import { strictEqual } from 'node:assert'

test('add2', () => {
  strictEqual(add(3, 2), 5)
})

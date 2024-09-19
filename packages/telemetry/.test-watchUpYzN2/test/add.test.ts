import { test } from 'node:test'
import { add } from '../src/add.js'
import { strictEqual } from 'node:assert'

test('add', () => {
  strictEqual(add(1, 2), 3)
})

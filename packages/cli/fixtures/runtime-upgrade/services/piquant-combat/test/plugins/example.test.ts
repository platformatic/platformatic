import test from 'node:test'
import assert from 'node:assert'
import { getServer } from '../helper'

test('example decorator', async (t) => {
  const server = await getServer(t)

  assert.strictEqual(server.example, 'foobar')
})

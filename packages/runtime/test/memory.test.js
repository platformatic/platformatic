import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMemoryReader } from '../lib/memory.js'

test('memory readings are cached, shared by concurrent callers and keep the detected scope', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const calls = []
  let used = 100
  const readMemory = createMemoryReader({
    ttlMs: 1000,
    read: async options => {
      calls.push(options)
      return { scope: 'cgroup-v2', used: used++, total: 1000 }
    }
  })

  const [first, second] = await Promise.all([readMemory(), readMemory()])
  assert.deepStrictEqual(first, { scope: 'cgroup-v2', used: 100, total: 1000 })
  assert.strictEqual(second, first)
  assert.deepStrictEqual(calls, [{ scope: undefined }])

  t.mock.timers.tick(999)
  assert.strictEqual((await readMemory()).used, 100)
  assert.strictEqual(calls.length, 1)

  t.mock.timers.tick(1)
  assert.strictEqual((await readMemory()).used, 101)
  assert.deepStrictEqual(calls[1], { scope: 'cgroup-v2' })
})

test('a failed memory read is not cached', async () => {
  let fail = true
  const readMemory = createMemoryReader({
    read: async () => {
      if (fail) throw new Error('unavailable')
      return { scope: 'host', used: 1, total: 2 }
    }
  })

  await assert.rejects(readMemory(), /unavailable/)
  fail = false
  assert.deepStrictEqual(await readMemory(), { scope: 'host', used: 1, total: 2 })
})

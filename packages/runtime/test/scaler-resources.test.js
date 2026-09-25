import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resourceUsage } from '../public/scaler/resources.js'

function application (id, heaps, targetCount = heaps.length) {
  return {
    id,
    liveCount: heaps.length,
    targetCount,
    workers: heaps.map((value, index) => ({ id: `${id}:${index}-123`, metrics: { heap: { value } } }))
  }
}

function snapshot (applications, memory = { used: 700, limit: 1000 }, maxTotalWorkers = 8) {
  return { applications, memory, maxTotalWorkers }
}

test('worker slots include every application and distinguish live workers, scheduled workers and available capacity', () => {
  const state = snapshot([application('api', [100, 200], 4), application('jobs', [50])])
  const original = structuredClone(state)
  const { workers } = resourceUsage(state)
  assert.equal(workers.live, 3)
  assert.equal(workers.scheduled, 2)
  assert.equal(workers.available, 3)
  assert.equal(workers.scale, 8)
  assert.deepEqual(workers.segments.map(({ label, value, kind }) => ({ label, value, kind })), [
    { label: 'api:0', value: 1, kind: 'worker' },
    { label: 'api:1', value: 1, kind: 'worker' },
    { label: 'api · scheduled', value: 2, kind: 'scheduled' },
    { label: 'jobs:0', value: 1, kind: 'worker' },
    { label: 'Available', value: 3, kind: 'available' }
  ])
  assert.deepEqual(state, original)
})

test('heap segments show worker measurements and scale-up headroom without other system memory', () => {
  const { memory } = resourceUsage(snapshot([application('api', [100, 200]), application('jobs', [50])]))
  assert.equal(memory.heapUsed, 350)
  assert.equal(memory.available, 300)
  assert.deepEqual(memory.segments.map(segment => segment.value), [100, 200, 50, 300])
  assert.equal(memory.scale, 650)
  assert.ok(memory.segments.every(segment => segment.kind === 'worker' || segment.kind === 'available'))
})

test('over-limit rows retain every worker and byte and show no available capacity', () => {
  const { workers, memory } = resourceUsage(snapshot([application('api', [400, 400], 3)], { used: 1100, limit: 1000 }, 2))
  assert.equal(workers.available, 0)
  assert.equal(workers.scale, 3)
  assert.equal(workers.segments.reduce((sum, segment) => sum + segment.value, 0), 3)
  assert.equal(memory.available, 0)
  assert.equal(memory.scale, 800)
  assert.equal(memory.segments.reduce((sum, segment) => sum + segment.value, 0), 800)
})

test('missing heap samples remain occupied worker slots and are not invented as heap allocations', () => {
  const { workers, memory } = resourceUsage(snapshot([application('api', [undefined, NaN, -1, 0, 100])]))
  assert.equal(workers.live, 5)
  assert.equal(memory.missingHeap, 3)
  assert.equal(memory.heapUsed, 100)
  assert.equal(memory.available, 300)
  assert.equal(memory.segments.filter(segment => segment.kind === 'worker').length, 1)
})

test('available memory uses the same headroom as the scaler even when heap samples were taken at a different time', () => {
  const { memory } = resourceUsage(snapshot([application('api', [400, 400])], { used: 700, limit: 750 }))
  assert.equal(memory.available, 50)
  assert.equal(memory.scale, 850)
  assert.ok(memory.segments.every(segment => segment.value > 0))
})

test('empty runtimes and unavailable memory have an explicit empty state', () => {
  const { workers, memory } = resourceUsage(snapshot([], null))
  assert.deepEqual(workers.segments, [{ kind: 'available', label: 'Available', value: 8 }])
  assert.equal(memory, null)
})

test('a zero memory budget leaves no headroom for scaling', () => {
  const { memory } = resourceUsage(snapshot([application('api', [100])], { used: 200, limit: 0 }))
  assert.equal(memory.available, 0)
  assert.equal(memory.scale, 100)
})

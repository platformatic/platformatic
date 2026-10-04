import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
const require = createRequire(import.meta.url)
const routing = require('../../../packages/runtime/lib/mesh/lib/request-routing.js')
const symbols = require('../../../packages/runtime/lib/mesh/lib/utils.js')
const { install } = require('./policy.cjs')
const original = routing.select

function check (mode, loads, expected, stale = false) {
  routing.select = original
  install(routing, symbols, mode)
  const held = []
  const pool = { index: 0, ports: loads.map((load, id) => {
    const state = routing.createState({ maxOutstanding: 8 })
    routing.setReady(state, true)
    routing.recordHealth(state, id ? 0.1 : 0.99, 0.2)
    for (let i = 0; i < load; i++) held.push(routing.reserve(state))
    if (stale && id === 1) Atomics.store(routing.view(state), 10, (Date.now() - 1000) & 0x7fffffff)
    return { id, [symbols.kReady]: true, [routing.kRouting]: state }
  }) }
  try {
    const selection = routing.select(pool, 'app.plt.local')
    held.push(selection.reservation)
    assert.equal(selection.port.id, expected)
  } finally {
    held.forEach(routing.release)
    assert.deepEqual(pool.ports.map(port => routing.outstanding(port[routing.kRouting])), [0, 0])
    routing.select = original
  }
}

test('health breaks equal-load ties without changing reservations', () => check('tie', [0, 0], 1))
test('tie preference cannot override unequal queue lengths', () => check('tie', [0, 1], 0))
test('bounded preference can admit one additional request to the cooler worker', () => check('bounded', [0, 1], 1))
test('bounded preference stops favoring the cooler worker beyond its allowance', () => check('bounded', [0, 2], 0))
test('stale health falls back to least outstanding', () => check('bounded', [0, 1], 0, true))

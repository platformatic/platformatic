import { test } from 'node:test'
import { strictEqual, ok, deepStrictEqual } from 'node:assert'
import { Worker } from 'node:worker_threads'
import { createRequire } from 'node:module'
import routing from '../lib/mesh/lib/request-routing.js'
const { createState, setReady, snapshot, reserve, release, accept, reclaimSender, retire, leases, HEADER } = routing

test('capacity is bounded, leases release once and old generations stay separate', () => {
  const state = createState({ maxOutstanding: 2 }); setReady(state, true)
  const a = reserve(state, 11); const b = reserve(state, 12)
  strictEqual(reserve(state), null); strictEqual(snapshot(state).outstanding, 2)
  strictEqual(accept(a, state), true)
  reclaimSender(state, 11); strictEqual(snapshot(state).outstanding, 2)
  reclaimSender(state, 12); strictEqual(snapshot(state).outstanding, 1)
  const c = reserve(state, 13)
  strictEqual(release(b), false); strictEqual(snapshot(state).outstanding, 2)
  strictEqual(release(a), true); strictEqual(release(a), false)
  const replacement = createState({ maxOutstanding: 2 }); setReady(replacement, true)
  strictEqual(accept(c, replacement), false)
  strictEqual(snapshot(replacement).accountingErrors, 1)
  retire(state); strictEqual(release(c), false); strictEqual(snapshot(replacement).outstanding, 0)
  setReady(replacement, false); strictEqual(reserve(replacement), null)
})

test('a sender interrupted before publishing its lease cannot leak admission capacity', () => {
  const state = createState({ maxOutstanding: 1 }); setReady(state, true)
  Atomics.store(leases(state), HEADER / 2, -43n)
  strictEqual(reserve(state), null)
  reclaimSender(state, 43)
  const r = reserve(state, 44); ok(r); strictEqual(release(r), true)
  strictEqual(snapshot(state).outstanding, 0)
})

test('multiple callers share a finite pool without duplicate accepted leases', async () => {
  const state = createState({ maxOutstanding: 8 }); setReady(state, true)
  const require = createRequire(import.meta.url)
  const module = require.resolve('../lib/mesh/lib/request-routing.js')
  const reports = await Promise.all(Array.from({ length: 4 }, (_, i) => new Promise((resolve, reject) => {
    const worker = new Worker(`
      const { parentPort, workerData } = require('node:worker_threads')
      const r = require(workerData.module)
      let completed = 0
      while (completed < 5000) {
        const token = r.reserve(workerData.state, workerData.owner)
        if (!token) continue
        if (!r.accept(token, workerData.state)) throw Error('accept failed')
        if (!r.release(token)) throw Error('release failed')
        completed++
      }
      parentPort.postMessage(completed)
    `, { eval: true, workerData: { module, state, owner: i + 10 } })
    worker.on('message', resolve); worker.on('error', reject)
    worker.on('exit', code => { if (code) reject(new Error(`worker exit ${code}`)) })
  })))
  deepStrictEqual(reports, [5000, 5000, 5000, 5000])
  strictEqual(snapshot(state).outstanding, 0); strictEqual(snapshot(state).completed, 20000)
})

test('worker selection skips draining workers and keeps reservation pressure across callers', async () => {
  const { RoundRobin } = await import('../lib/mesh/lib/roundrobin.js')
  const { default: { kReady, kThread } } = await import('../lib/mesh/lib/utils.js')
  const rr = new RoundRobin()
  const states = [createState({ maxOutstanding: 2 }), createState({ maxOutstanding: 2 })]
  const ports = states.map((state, i) => ({ [kReady]: true, [kThread]: i + 1, [routing.kRouting]: state }))
  states.forEach(s => setReady(s, true)); ports.forEach(p => rr.add(p))
  const first = routing.select(rr, 'alpha')
  const second = routing.select(rr, 'alpha')
  ok(first.port !== second.port)
  setReady(states[0], false)
  const third = routing.select(rr, 'alpha'); strictEqual(third.port, ports[1])
  const { throws } = await import('node:assert')
  throws(() => routing.select(rr, 'alpha'), { code: 'PLT_REQUEST_CAPACITY_EXCEEDED' })
  ;[first, second, third].forEach(s => release(s.reservation))
  deepStrictEqual(states.map(s => snapshot(s).outstanding), [0, 0])
})

test('generation leases and metrics continue beyond signed 32-bit request counts', () => {
  const state = createState({ maxOutstanding: 1 }); setReady(state, true)
  Atomics.store(leases(state), 7, 0x7fffffffn)
  Atomics.store(leases(state), 2, 0x7fffffffn)
  Atomics.store(leases(state), 3, 0x7fffffffn)
  const token = reserve(state); strictEqual(token.lease, 0x80000000n)
  strictEqual(snapshot(state).selected, 0x80000000)
  strictEqual(accept(token, state), true); strictEqual(release(token), true)
  strictEqual(snapshot(state).completed, 0x80000000); strictEqual(snapshot(state).outstanding, 0)
})

test('experimental pressure preference falls back to available hot or stale workers', async () => {
  const { RoundRobin } = await import('../lib/mesh/lib/roundrobin.js')
  const { default: { kReady } } = await import('../lib/mesh/lib/utils.js')
  const rr = new RoundRobin()
  const states = [routing.createState({ algorithm: 'pressure', maxOutstanding: 1 }), routing.createState({ algorithm: 'pressure', maxOutstanding: 1 })]
  const ports = states.map(state => ({ [kReady]: true, [routing.kRouting]: state }))
  states.forEach(s => routing.setReady(s, true)); ports.forEach(p => rr.add(p))
  routing.recordHealth(states[0], 0.1, 0.1); routing.recordHealth(states[1], 0.99, 0.99)
  const cool = routing.select(rr, 'alpha'); strictEqual(cool.port, ports[0])
  const hot = routing.select(rr, 'alpha'); strictEqual(hot.port, ports[1])
  release(cool.reservation); release(hot.reservation)
  states.forEach(s => Atomics.store(routing.view(s), 10, (Date.now() - 2000) & 0x7fffffff))
  const stale = routing.select(rr, 'alpha'); ok(stale.reservation); release(stale.reservation)
})

test('a late backend readiness update cannot revive a draining generation', () => {
  const state = createState({ maxOutstanding: 1 }); setReady(state, true)
  const accepted = reserve(state); strictEqual(accept(accepted, state), true)
  routing.beginDrain(state); setReady(state, true)
  strictEqual(snapshot(state).ready, 0); strictEqual(reserve(state), null)
  strictEqual(snapshot(state).outstanding, 1)
  strictEqual(release(accepted), true); strictEqual(snapshot(state).outstanding, 0)
})

'use strict'

const { randomInt } = require('node:crypto')
const { threadId } = require('node:worker_threads')
const { kReady, kAddress } = require('./utils')
const HEADER = 24
const WIDTH = 4
const kRouting = Symbol('requestRouting')
const views = new WeakMap()
const tokenViews = new WeakMap()
const kLocalRouting = Symbol('localRequestRouting')

function createState ({ algorithm = 'least-outstanding', maxOutstanding = 128 } = {}) {
  if (!['least-outstanding', 'pressure'].includes(algorithm) || !Number.isInteger(maxOutstanding) || maxOutstanding < 1 || maxOutstanding > 4096) {
    throw new TypeError('Invalid request routing configuration')
  }
  const state = { algorithm, maxOutstanding, buffer: new SharedArrayBuffer((HEADER + WIDTH * maxOutstanding + ((Math.ceil(maxOutstanding / 32) + 1) & ~1)) * 4) }
  const a = view(state)
  Atomics.store(a, 11, randomInt(1, 0x7fffffff))
  Atomics.store(a, 12, randomInt(1, 0x7fffffff))
  return state
}

function view (state) {
  let a = views.get(state)
  if (!a) { a = new Int32Array(state.buffer); views.set(state, a) }
  return a
}
function leases (state) {
  let a = tokenViews.get(state)
  if (!a) { a = new BigInt64Array(state.buffer); tokenViews.set(state, a) }
  return a
}
function setReady (state, ready) { if (state) Atomics.store(view(state), 0, ready ? 1 : 0) }
function beginDrain (state) {
  if (!state) return
  Atomics.store(view(state), 18, 1)
  Atomics.store(view(state), 0, 0)
}
function retire (state) {
  if (!state) return
  const a = view(state)
  const tokens = leases(state)
  beginDrain(state)
  // Retire only after the actual backend thread exits. Every caller still sees
  // the old buffer, so completions cannot alter the next generation's state.
  for (let i = HEADER; i < HEADER + WIDTH * state.maxOutstanding; i += WIDTH) Atomics.store(tokens, i / 2, 0n)
  for (let i = HEADER + WIDTH * state.maxOutstanding; i < a.length; i++) Atomics.store(a, i, 0)
}
function bit (state, slot, occupied) {
  const index = (slot - HEADER) / WIDTH
  const word = HEADER + WIDTH * state.maxOutstanding + (index >>> 5)
  if (occupied) Atomics.or(view(state), word, 1 << (index & 31))
  else Atomics.and(view(state), word, ~(1 << (index & 31)))
}
function outstanding (state) {
  const a = view(state)
  let count = 0
  // This bitmap is an approximate scheduling snapshot. The lease slots are
  // authoritative for the capacity bound. No multi-atomic counter transaction
  // can leak capacity when a caller is terminated between instructions.
  for (let i = HEADER + WIDTH * state.maxOutstanding; i < a.length; i++) {
    let n = Atomics.load(a, i) >>> 0
    n = n - ((n >>> 1) & 0x55555555)
    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333)
    count += (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24
  }
  return count
}
function snapshot (state) {
  const a = view(state)
  return {
    ready: Atomics.load(a, 0) && !Atomics.load(a, 18) ? 1 : 0,
    outstanding: outstanding(state),
    rejected: Number(Atomics.load(leases(state), 1)),
    selected: Number(Atomics.load(leases(state), 2)),
    completed: Number(Atomics.load(leases(state), 3)),
    accountingErrors: Number(Atomics.load(leases(state), 8)),
    elu: Atomics.load(a, 10) ? Atomics.load(a, 8) / 1000 : null,
    heapRatio: Atomics.load(a, 10) ? Atomics.load(a, 9) / 1000 : null,
    sampledAt: Atomics.load(a, 10)
  }
}
function recordHealth (state, elu, heapRatio) {
  const a = view(state)
  Atomics.store(a, 8, Math.round(elu * 1000))
  Atomics.store(a, 9, Math.round(heapRatio * 1000))
  Atomics.store(a, 10, Date.now() & 0x7fffffff)
}
function release (reservation) {
  if (!reservation) return false
  const { state, slot, lease } = reservation
  const a = view(state)
  const tokens = leases(state)
  // A lease is unique within this generation. Old or duplicate notifications
  // cannot release a reused slot. Publish FREE only after cleanup is complete.
  if (Atomics.compareExchange(tokens, slot / 2, lease, -BigInt(threadId + 1)) !== lease) return false
  Atomics.add(tokens, 3, 1n)
  Atomics.store(a, slot + 2, 0)
  Atomics.store(a, slot + 3, 0)
  bit(state, slot, false)
  Atomics.store(tokens, slot / 2, 0n)
  return true
}
function reserve (state, owner = threadId + 1) {
  const a = view(state)
  const tokens = leases(state)
  if (!Atomics.load(a, 0) || Atomics.load(a, 18)) return null
  const start = (Atomics.add(a, 1, 1) >>> 0) % state.maxOutstanding
  for (let i = 0; i < state.maxOutstanding; i++) {
    const slot = HEADER + ((start + i) % state.maxOutstanding) * WIDTH
    if (Atomics.compareExchange(tokens, slot / 2, 0n, -BigInt(owner)) !== 0n) continue
    bit(state, slot, true)
    // Never wrap a lease: refuse further work until the generation is replaced.
    const lease = Atomics.add(tokens, 7, 1n) + 1n
    if (lease <= 0n || lease >= 0x7fffffffffffffffn) {
      Atomics.store(a, 0, 0)
      bit(state, slot, false)
      Atomics.store(tokens, slot / 2, 0n)
      throw new Error('Request reservation generation exhausted')
    }
    Atomics.store(a, slot + 2, owner)
    Atomics.store(a, slot + 3, 0)
    Atomics.store(tokens, slot / 2, lease)
    const reservation = { state, slot, lease }
    Atomics.add(tokens, 2, 1n)
    if (!Atomics.load(a, 0) || Atomics.load(a, 18)) { release(reservation); return null }
    return reservation
  }
  return null
}
function serialized (reservation) {
  if (!reservation) return undefined
  const a = view(reservation.state)
  return { slot: reservation.slot, lease: reservation.lease, nonce: [Atomics.load(a, 11), Atomics.load(a, 12)] }
}
function invalidReservation (state) { Atomics.add(leases(state), 8, 1n); return false }
function accept (reservation, localState) {
  if (!reservation || !localState) return !reservation
  // Structured cloning preserves shared storage, not object identity. Verify
  // this is our own generation before changing it, using a generation nonce.
  if (!reservation.state) {
    const a = view(localState)
    if (!reservation.nonce || reservation.nonce[0] !== Atomics.load(a, 11) || reservation.nonce[1] !== Atomics.load(a, 12)) return invalidReservation(localState)
    reservation.state = localState
  }
  const a = view(reservation.state)
  const local = view(localState)
  if (a.length !== local.length || Atomics.load(a, 11) !== Atomics.load(local, 11) || Atomics.load(a, 12) !== Atomics.load(local, 12)) return invalidReservation(localState)
  if (!Number.isInteger(reservation.slot) || reservation.slot < HEADER || reservation.slot >= HEADER + WIDTH * localState.maxOutstanding || (reservation.slot - HEADER) % WIDTH || typeof reservation.lease !== 'bigint' || reservation.lease <= 0n) return invalidReservation(localState)
  if (Atomics.load(leases(reservation.state), reservation.slot / 2) !== reservation.lease) return invalidReservation(localState)
  Atomics.store(a, reservation.slot + 3, 1)
  return true
}
function reclaimSender (state, owner) {
  if (!state) return
  const a = view(state)
  const tokens = leases(state)
  for (let slot = HEADER; slot < HEADER + WIDTH * state.maxOutstanding; slot += WIDTH) {
    const lease = Atomics.load(tokens, slot / 2)
    if (lease < 0n && lease === -BigInt(owner)) {
      // A sender can die between claiming and publishing a reservation.
      bit(state, slot, false)
      Atomics.compareExchange(tokens, slot / 2, lease, 0n)
    } else if (lease > 0n && Atomics.load(a, slot + 2) === owner && !Atomics.load(a, slot + 3)) {
      release({ state, slot, lease })
    }
  }
}
function overload (hostname) {
  const err = new Error(`No request capacity available for ${hostname}`)
  err.code = 'PLT_REQUEST_CAPACITY_EXCEEDED'
  err.statusCode = 503
  return err
}
function select (roundRobin, hostname) {
  if (!roundRobin) return { port: null }
  const ports = roundRobin.ports
  const configured = ports.find(p => p[kRouting])?.[kRouting]
  if (!configured) return { port: roundRobin.next() }
  const start = roundRobin.index++ % Math.max(1, ports.length)
  const candidates = []
  for (let i = 0; i < ports.length; i++) {
    const port = ports[(start + i) % ports.length]
    const state = port[kRouting]
    // TCP has no backend terminal acknowledgement in this implementation.
    // Never silently pretend client errors prove TCP backend work stopped.
    if (!port[kReady] || !state || port[kAddress] || (!Atomics.load(view(state), 0) || Atomics.load(view(state), 18))) continue
    candidates.push({ port, state, load: outstanding(state) })
  }
  if (configured.algorithm === 'pressure') {
    const cool = ({ state }) => {
      const a = view(state)
      const age = ((Date.now() & 0x7fffffff) - Atomics.load(a, 10)) & 0x7fffffff
      return age <= 1500 && Atomics.load(a, 8) < 850 && Atomics.load(a, 9) < 850
    }
    // Prefer fresh headroom, but try all ready workers before rejecting capacity.
    candidates.sort((a, b) => Number(cool(b)) - Number(cool(a)) || a.load - b.load)
  } else {
    candidates.sort((a, b) => a.load - b.load)
  }
  for (const { port, state } of candidates) {
    const reservation = reserve(state)
    if (reservation) return { port, reservation }
  }
  Atomics.add(leases(configured), 1, 1n)
  throw overload(hostname)
}

module.exports = {
  createState,
  view,
  leases,
  outstanding,
  setReady,
  beginDrain,
  retire,
  snapshot,
  recordHealth,
  reserve,
  release,
  accept,
  reclaimSender,
  serialized,
  overload,
  select,
  kRouting,
  kLocalRouting,
  HEADER,
  WIDTH
}

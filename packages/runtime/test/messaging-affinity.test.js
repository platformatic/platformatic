import { abstractLogger } from '@platformatic/foundation'
import { deepStrictEqual, ok, rejects, strictEqual, throws } from 'node:assert'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { pickByAffinity } from '../lib/worker/affinity.js'
import { MessagingITC } from '../lib/worker/messaging.js'
import { kWorkersBroadcast } from '../lib/worker/symbols.js'

function createWorkers (application, indexes) {
  return indexes.map(index => ({ id: `${application}:${index}`, application, worker: index, thread: 100 + index }))
}

function createKeys (count) {
  return Array.from({ length: count }, (_, i) => `key-${i}`)
}

test('pickByAffinity is deterministic and independent of the workers order', () => {
  const workers = createWorkers('app', [0, 1, 2, 3])
  const reversed = workers.toReversed()

  for (const key of createKeys(100)) {
    const selected = pickByAffinity(workers, key)
    strictEqual(pickByAffinity(workers, key), selected)
    strictEqual(pickByAffinity(reversed, key), selected)
  }
})

test('pickByAffinity distributes keys evenly', () => {
  const workers = createWorkers('app', [0, 1, 2, 3])
  const counts = new Map(workers.map(worker => [worker.id, 0]))
  const keys = createKeys(10000)

  for (const key of keys) {
    const { id } = pickByAffinity(workers, key)
    counts.set(id, counts.get(id) + 1)
  }

  for (const [id, count] of counts) {
    ok(count > 2000 && count < 3000, `worker ${id} received ${count} keys`)
  }
})

test('pickByAffinity only moves the keys of the added or removed worker', () => {
  const workers = createWorkers('app', [0, 1, 2])
  const added = createWorkers('app', [0, 1, 2, 3])
  const removed = createWorkers('app', [0, 2])

  for (const key of createKeys(2000)) {
    const before = pickByAffinity(workers, key).id

    const afterAdd = pickByAffinity(added, key).id
    ok(afterAdd === before || afterAdd === 'app:3', `key ${key} moved from ${before} to ${afterAdd}`)

    const afterRemove = pickByAffinity(removed, key).id
    if (before !== 'app:1') {
      strictEqual(afterRemove, before)
    }
  }
})

test('pickByAffinity returns undefined when there are no workers', () => {
  strictEqual(pickByAffinity([], 'key'), undefined)
})

async function broadcastWorkers (messaging, workers) {
  const changed = new Promise(resolve => {
    const unsubscribe = messaging.onWorkersChange(() => {
      unsubscribe()
      resolve()
    })
  })

  const channel = new BroadcastChannel(kWorkersBroadcast)
  channel.postMessage(new Map(Object.entries(workers)))
  channel.close()

  await changed
}

function createMessaging (t) {
  const messaging = new MessagingITC(`test-${randomUUID()}`, { messagingTimeout: 1000 }, abstractLogger)
  t.after(() => messaging.close())
  return messaging
}

test('MessagingITC exposes the workers and notifies changes', async t => {
  const messaging = createMessaging(t)
  const events = []
  const unsubscribe = messaging.onWorkersChange(workers => events.push(workers))

  deepStrictEqual(messaging.getWorkers(), {})
  deepStrictEqual(messaging.getWorkers('first'), [])

  const first = createWorkers('first', [0, 1])
  const second = createWorkers('second', [0])
  await broadcastWorkers(messaging, { first, second })

  deepStrictEqual(messaging.getWorkers(), { first, second })
  deepStrictEqual(messaging.getWorkers('first'), first)
  deepStrictEqual(events, [{ first, second }])

  unsubscribe()
  await broadcastWorkers(messaging, { first: first.slice(1) })
  deepStrictEqual(messaging.getWorkers('first'), first.slice(1))
  strictEqual(events.length, 1)
})

test('MessagingITC resolves the worker for an affinity key', async t => {
  const messaging = createMessaging(t)

  strictEqual(messaging.getWorkerForAffinity('first', 'key'), null)

  const first = createWorkers('first', [0, 1, 2])
  await broadcastWorkers(messaging, { first })

  for (const key of createKeys(50)) {
    deepStrictEqual(messaging.getWorkerForAffinity('first', key), pickByAffinity(first, key))
  }
})

test('MessagingITC validates affinity keys and listeners', async t => {
  const messaging = createMessaging(t)

  for (const affinity of ['', 42, null, {}]) {
    throws(() => messaging.getWorkerForAffinity('first', affinity), { code: 'PLT_RUNTIME_INVALID_ARGUMENT' })
    await rejects(messaging.send('first', 'message', {}, { affinity }), { code: 'PLT_RUNTIME_INVALID_ARGUMENT' })
  }

  throws(() => messaging.onWorkersChange('not a function'), { code: 'PLT_RUNTIME_INVALID_ARGUMENT' })
})

test('MessagingITC rejects affinity messages when the application has no workers', async t => {
  const messaging = createMessaging(t)

  await rejects(messaging.send('missing', 'message', {}, { affinity: 'key' }), {
    code: 'PLT_RUNTIME_MESSAGING_ERROR'
  })
})

test('MessagingITC logs failing workers change listeners', async t => {
  const errors = []
  const logger = { ...abstractLogger, error: (...args) => errors.push(args) }
  const messaging = new MessagingITC(`test-${randomUUID()}`, { messagingTimeout: 1000 }, logger)
  t.after(() => messaging.close())

  messaging.onWorkersChange(() => {
    throw new Error('kaboom')
  })

  const listenerCalled = new Promise(resolve => messaging.onWorkersChange(resolve))

  const channel = new BroadcastChannel(kWorkersBroadcast)
  channel.postMessage(new Map([['first', createWorkers('first', [0])]]))
  channel.close()

  await listenerCalled
  strictEqual(errors.length, 1)
  strictEqual(errors[0][0].err.message, 'kaboom')
})

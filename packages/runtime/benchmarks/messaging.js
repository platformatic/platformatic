// Measures messaging.send round trips through MessagingITC, the class every Watt worker uses for
// inter-application messaging. Loopback messaging keeps both ends in this thread, so the CPU
// column covers sender and receiver.
//
// Usage: node benchmarks/messaging.js
import { getMessaging } from '@platformatic/globals'
import { performance } from 'node:perf_hooks'
import { setupLoopbackMessaging } from '../lib/loopback-messaging.js'

async function measure (name, iterations, concurrency, fn) {
  async function run (count) {
    for (let i = 0; i < count; i++) {
      await fn()
    }
  }

  async function runAll (count) {
    const perWorker = Math.ceil(count / concurrency)
    await Promise.all(Array.from({ length: concurrency }, () => run(perWorker)))
  }

  await runAll(Math.max(iterations / 10, 1000))

  const startedAt = performance.now()
  const startCpu = process.cpuUsage()
  await runAll(iterations)

  const elapsed = performance.now() - startedAt
  const cpu = process.cpuUsage(startCpu)

  console.log(
    `${name.padEnd(44)} ${Math.round((iterations * 1000) / elapsed)
      .toLocaleString('en-US')
      .padStart(12)} ops/s ${((elapsed * 1000) / iterations).toFixed(2).padStart(9)} µs/op ${(
      (cpu.user + cpu.system) /
      iterations
    )
      .toFixed(2)
      .padStart(9)} µs CPU/op`
  )
}

const query = {
  sql: 'SELECT id, name FROM storage.objects WHERE bucket_id = $1 AND name = $2 LIMIT 1',
  values: ['avatars', 'folder/file.png'],
  destination: { id: 'tenant', isExternalPool: false, maxConnections: 10 }
}

const loopback = setupLoopbackMessaging('benchmark', { runtimeConfig: { messagingTimeout: 30_000 } })
loopback.handle('query', () => ({ rows: [{ id: 1 }], rowCount: 1 }))
loopback.handle('query-unsanitized', () => ({ rows: [{ id: 1 }], rowCount: 1 }), { sanitize: false })

const messaging = getMessaging()
const signal = new AbortController().signal

await measure('messaging.send', 50_000, 1, () => messaging.send('benchmark', 'query', query))
await measure('messaging.send, 32 in flight', 100_000, 32, () => messaging.send('benchmark', 'query', query))
await measure('messaging.send, with signal', 50_000, 1, () => messaging.send('benchmark', 'query', query, { signal }))
await measure('messaging.send, sanitize: false', 50_000, 1, () =>
  messaging.send('benchmark', 'query-unsanitized', query, { sanitize: false })
)

loopback.unmount()

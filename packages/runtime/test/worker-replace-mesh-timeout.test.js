import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { once } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime, readLogs } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

// The mesh interceptor waits at most 5 seconds for every other thread to acknowledge a route removal.
// The blocker must therefore stay blocked for longer than the route addition of the new worker (up to 5s)
// plus the route removal of the old one (up to 5s).
const BLOCK_DURATION = 15000

function getTargetWorkers (workers) {
  return Object.entries(workers).filter(([id]) => id.startsWith('target:'))
}

test('replacing a worker whose mesh removal times out does not leave an extra worker behind', async t => {
  const context = {}
  const runtime = await createRuntime(join(fixturesDir, 'replace-mesh-timeout'), null, context)
  const url = await runtime.start()

  t.after(() => runtime.close())

  const before = getTargetWorkers(await runtime.getWorkers())
  strictEqual(before.length, 1)

  // Block the event loop of the other application in the mesh. The blocker flushes a first chunk
  // right before entering its synchronous wait, so wait for it rather than guessing a delay.
  const { body } = await request(`${url}/block?ms=${BLOCK_DURATION}`)
  const unblocked = once(body, 'end')
  const [chunk] = await once(body, 'data')
  strictEqual(chunk.toString(), 'blocking\n')

  // Replace the target worker while the blocker cannot acknowledge mesh messages
  await runtime.restartApplication('target')

  // Let the blocker unblock and everything settle
  await unblocked
  await sleep(2000)

  const after = getTargetWorkers(await runtime.getWorkers())
  deepStrictEqual(
    after.map(([, worker]) => worker.status),
    ['started'],
    `expected a single started target worker, got ${JSON.stringify(after)}`
  )
  ok(after[0][0] !== before[0][0], 'the target worker should have been replaced')

  // The mesh is still working for the replacement worker
  const response = await request(`${url}/target`)
  strictEqual(response.statusCode, 200)
  deepStrictEqual(await response.body.json(), { from: 'target', worker: Number(after[0][0].split(':')[1]) })

  const logs = await readLogs(context.logsPath, 0)
  const messages = logs.map(log => log.msg).filter(Boolean)

  ok(!messages.some(m => m.includes('unexpectedly exited')), 'no worker should be reported as crashed')
  ok(!messages.some(m => m.includes('will be restarted')), 'no worker should be restarted')
  ok(messages.some(m => m.startsWith('Cannot remove the worker 0 of the application "target" from the mesh')))
})

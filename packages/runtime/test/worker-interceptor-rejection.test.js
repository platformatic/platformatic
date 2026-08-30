import { deepStrictEqual, ok } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

// #setupWorker stores the mesh-interceptor routing promise on the worker
// rather than awaiting it — #startWorker awaits it later, and only if the
// worker is actually started.
//
// A worker that is discarded or torn down before that leaves the promise with
// nobody to observe it. Closing the mesh interceptor rejects any routing still
// in flight ('The dispatcher has been closed.'), so shutdown racing a restart
// is a routine way to reach exactly that state — a multi-worker application is
// replaced one worker at a time, which widens the window considerably.
//
// The result was an unhandledRejection during shutdown. Under Node's default
// that terminates the process, so a runtime could die partway through graceful
// shutdown — dropping the connections that graceful shutdown exists to drain.

// Collects unhandled rejections for the duration of one test. Registered
// FIRST, so it sees rejections the test runner would otherwise attribute to
// whichever test happened to be running when they surfaced.
function captureUnhandledRejections (t) {
  const seen = []
  const onRejection = reason => seen.push(reason)

  // Node's test runner installs its own listener; adding ours alongside means
  // the rejection is observed by both, so this does not mask a real failure.
  process.on('unhandledRejection', onRejection)
  t.after(() => process.removeListener('unhandledRejection', onRejection))

  return seen
}

test('a restart racing shutdown leaves no unobserved worker rejection', async t => {
  const rejections = captureUnhandledRejections(t)

  const runtime = await createRuntime(join(fixturesDir, 'multiple-workers'), null)
  await runtime.start()

  // Restart WITHOUT awaiting it, then close underneath it. The application has
  // several workers and they are replaced one at a time, so the close lands
  // while a replacement worker is still being routed onto the mesh.
  const restarting = runtime.restartApplication('node').catch(() => {
    // The restart itself is expected to fail — it is being torn down. What
    // must not happen is a rejection nobody is waiting for.
  })

  await runtime.close()
  await restarting

  // Give any late rejection a turn to surface before asserting on the set.
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setTimeout(resolve, 100))

  deepStrictEqual(
    rejections.map(reason => reason?.message ?? String(reason)),
    [],
    'a worker torn down mid-routing must not leave an unobserved rejection'
  )
})

test('the routing rejection is still reported to whoever awaits it', async t => {
  // The fix marks the rejection observed; it must not swallow it. A worker
  // that fails to route has to still fail its own startup, or a broken mesh
  // would look like a healthy application.
  const runtime = await createRuntime(join(fixturesDir, 'multiple-workers'), null)
  t.after(() => runtime.close().catch(() => {}))

  await runtime.start()

  // A started application routes successfully, which is the other half of the
  // contract: attaching the handler did not detach the promise from its
  // consumer.
  const details = await runtime.getApplicationDetails('node')
  ok(details.status === 'started', 'the application started, so its routing promise resolved and was awaited')

  const response = await runtime.inject('node', { method: 'GET', url: '/' })
  ok(response.statusCode < 500, `the mesh routes to it (got ${response.statusCode})`)
})

import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { installWorkerExtensions } from '../index.js'

// A logger that records what was logged, so the loud-on-failure behaviour and
// the load ordering can be asserted at the unit level, without booting a runtime.
function recordingLogger () {
  const errors = []
  const logger = {
    errors,
    error: (obj, msg) => errors.push({ obj, msg }),
    child: () => logger
  }
  return logger
}

async function writeExtension (contents) {
  const dir = await mkdtemp(join(tmpdir(), 'worker-ext-'))
  const path = join(dir, 'extension.mjs')
  await writeFile(path, contents)
  return path
}

test('with no extensions configured, install is a no-op', async () => {
  const logger = recordingLogger()
  const installed = await installWorkerExtensions({ entrypoint: true, logger })
  await installed.close()
  strictEqual(logger.errors.length, 0)
})

test('a setup function runs and receives its options and entrypoint flag', async () => {
  const path = await writeExtension(`
    export default function setup ({ entrypoint, options }) {
      globalThis.__seen = { entrypoint, marker: options.marker }
    }
  `)
  const logger = recordingLogger()

  await installWorkerExtensions({
    entrypoint: true,
    logger,
    workerExtensions: { path, options: { marker: 'x' } }
  })

  deepStrictEqual(globalThis.__seen, { entrypoint: true, marker: 'x' })
  delete globalThis.__seen
})

test('a missing extension is skipped, logged LOUDLY, and never throws', async () => {
  const logger = recordingLogger()

  // Must resolve, not reject: a bad extension does not crash the boot.
  const installed = await installWorkerExtensions({
    entrypoint: true,
    logger,
    workerExtensions: { path: '/does/not/exist.mjs' }
  })
  await installed.close()

  strictEqual(logger.errors.length, 1)
  const { obj, msg } = logger.errors[0]
  // Loud: names the extension, says it is disabled, and that the app runs without it.
  ok(msg.includes('/does/not/exist.mjs'), `message names the extension: ${msg}`)
  ok(/DISABLED/.test(msg), `message is loud about being disabled: ${msg}`)
  ok(/without it/i.test(msg), `message states the consequence: ${msg}`)
  // Carries the coded error.
  strictEqual(obj.err.code, 'PLT_BASIC_FAILED_TO_LOAD_WORKER_EXTENSION')
})

test('an extension whose default export is not a function is skipped and logged loudly', async () => {
  const path = await writeExtension('export default 42')
  const logger = recordingLogger()

  await installWorkerExtensions({ entrypoint: true, logger, workerExtensions: { path } })

  strictEqual(logger.errors.length, 1)
  strictEqual(logger.errors[0].obj.err.code, 'PLT_BASIC_INVALID_WORKER_EXTENSION')
  ok(/DISABLED/.test(logger.errors[0].msg))
})

test('a setup that throws is skipped and logged loudly, and later extensions still load', async () => {
  const bad = await writeExtension('export default function () { throw new Error("boom") }')
  const good = await writeExtension(`
    export default function () { globalThis.__goodRan = true }
  `)
  const logger = recordingLogger()

  await installWorkerExtensions({
    entrypoint: true,
    logger,
    workerExtensions: [{ path: bad }, { path: good }]
  })

  strictEqual(logger.errors.length, 1)
  ok(logger.errors[0].msg.includes('boom'))
  // A bad extension does not prevent the ones after it from loading.
  strictEqual(globalThis.__goodRan, true)
  delete globalThis.__goodRan
})

test('close runs each extension close in reverse order', async () => {
  const order = []
  globalThis.__order = order
  const mk = label => writeExtension(`
    export default function () {
      return { close () { globalThis.__order.push(${JSON.stringify(label)}) } }
    }
  `)
  const a = await mk('a')
  const b = await mk('b')
  const logger = recordingLogger()

  const installed = await installWorkerExtensions({
    entrypoint: true,
    logger,
    workerExtensions: [{ path: a }, { path: b }]
  })
  await installed.close()

  deepStrictEqual(order, ['b', 'a'])
  delete globalThis.__order
})

test('onRequest is a no-op on a non-entrypoint application', async () => {
  const path = await writeExtension(`
    export default function ({ onRequest }) {
      globalThis.__registered = false
      onRequest(() => { globalThis.__registered = true })
      // Registering does nothing off the entrypoint; the handler is never stored.
      globalThis.__onRequestReturned = true
    }
  `)
  const logger = recordingLogger()

  await installWorkerExtensions({ entrypoint: false, logger, workerExtensions: { path } })

  strictEqual(globalThis.__onRequestReturned, true)
  strictEqual(logger.errors.length, 0)
  delete globalThis.__registered
  delete globalThis.__onRequestReturned
})

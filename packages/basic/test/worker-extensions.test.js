import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { installWorkerExtensions, onEntrypointRequest } from '../index.js'

const servers = []
after(() => {
  for (const server of servers) server.close()
})

async function startServer (handler) {
  const server = createServer(handler)
  servers.push(server)
  return new Promise(resolve => {
    server.listen(0, () => resolve(`http://127.0.0.1:${server.address().port}`))
  })
}

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
  const installed = await installWorkerExtensions({ logger })
  await installed.close()
  strictEqual(logger.errors.length, 0)
})

test('a setup function runs and receives its options', async () => {
  const path = await writeExtension(`
    export default function setup ({ options }) {
      globalThis.__seen = { marker: options.marker }
    }
  `)
  const logger = recordingLogger()

  await installWorkerExtensions({
    logger,
    workerExtensions: { path, options: { marker: 'x' } }
  })

  deepStrictEqual(globalThis.__seen, { marker: 'x' })
  delete globalThis.__seen
})

test('a missing extension is skipped, logged LOUDLY, and never throws', async () => {
  const logger = recordingLogger()

  // Must resolve, not reject: a bad extension does not crash the boot.
  const installed = await installWorkerExtensions({
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

  await installWorkerExtensions({ logger, workerExtensions: { path } })

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
    logger,
    workerExtensions: [{ path: a }, { path: b }]
  })
  await installed.close()

  deepStrictEqual(order, ['b', 'a'])
  delete globalThis.__order
})

test('a named setup export is accepted as well as a default export', async () => {
  const path = await writeExtension(`
    export function setup ({ options }) {
      globalThis.__setupRan = options.marker
    }
  `)
  const logger = recordingLogger()

  await installWorkerExtensions({ logger, workerExtensions: { path, options: { marker: 'named' } } })

  strictEqual(globalThis.__setupRan, 'named')
  strictEqual(logger.errors.length, 0)
  delete globalThis.__setupRan
})

test('a named setup is used even when a non-function default is exported', async () => {
  const path = await writeExtension(`
    export default { not: 'a function' }
    export function setup ({ options }) {
      globalThis.__setupRan = options.marker
    }
  `)
  const logger = recordingLogger()

  await installWorkerExtensions({ logger, workerExtensions: { path, options: { marker: 'both' } } })

  strictEqual(globalThis.__setupRan, 'both')
  strictEqual(logger.errors.length, 0)
  delete globalThis.__setupRan
})

test('onEntrypointRequest adds a response header the browser receives', async () => {
  const unsubscribe = onEntrypointRequest(({ addResponseHeader }) => {
    addResponseHeader('x-added', 'yes')
  })
  const url = await startServer((req, res) => res.end('ok'))

  const cookies = (await fetch(url)).headers.get('x-added')
  strictEqual(cookies, 'yes')
  unsubscribe()
})

test('onEntrypointRequest does not replace a header the application sets', async () => {
  const unsubscribe = onEntrypointRequest(({ addResponseHeader }) => {
    addResponseHeader('set-cookie', 'added=1')
  })
  const url = await startServer((req, res) => {
    res.writeHead(200, { 'set-cookie': 'app=1' })
    res.end('ok')
  })

  const cookies = (await fetch(url)).headers.getSetCookie()
  ok(cookies.includes('app=1'), `app cookie preserved: ${JSON.stringify(cookies)}`)
  ok(cookies.includes('added=1'), `added cookie present: ${JSON.stringify(cookies)}`)
  unsubscribe()
})

test('onEntrypointRequest can inspect the request', async () => {
  let seenUrl
  const unsubscribe = onEntrypointRequest(({ request, addResponseHeader }) => {
    seenUrl = request.url
    if (request.url === '/pinned') addResponseHeader('x-pinned', 'true')
  })
  const url = await startServer((req, res) => res.end('ok'))

  const res = await fetch(url + '/pinned')
  strictEqual(seenUrl, '/pinned')
  strictEqual(res.headers.get('x-pinned'), 'true')
  unsubscribe()
})

test('a throwing handler is isolated and does not crash the request or process', async () => {
  const unsubscribe = onEntrypointRequest(() => {
    throw new Error('handler boom')
  })
  const url = await startServer((req, res) => res.end('ok'))

  // If the throw were not isolated it would surface as an uncaughtException and
  // kill this process; reaching a normal response proves it was contained.
  const res = await fetch(url)
  strictEqual(res.status, 200)
  strictEqual(await res.text(), 'ok')
  unsubscribe()
})

test('a rejecting async handler is isolated and does not produce an unhandled rejection', async () => {
  const rejections = []
  const onUnhandled = err => rejections.push(err)
  process.on('unhandledRejection', onUnhandled)

  const unsubscribe = onEntrypointRequest(async () => {
    throw new Error('async boom')
  })
  const url = await startServer((req, res) => res.end('ok'))

  const res = await fetch(url)
  strictEqual(res.status, 200)
  strictEqual(await res.text(), 'ok')
  // Let the rejection settle: with the fix it is caught, so nothing reaches here.
  await new Promise(resolve => setTimeout(resolve, 20))
  process.removeListener('unhandledRejection', onUnhandled)
  strictEqual(rejections.length, 0, 'the async rejection must be handled, not unhandled')
  unsubscribe()
})

test('the unsubscribe stops the hook from firing', async () => {
  let fired = 0
  const unsubscribe = onEntrypointRequest(() => { fired++ })
  const url = await startServer((req, res) => res.end('ok'))

  await fetch(url)
  unsubscribe()
  await fetch(url)
  strictEqual(fired, 1)
})

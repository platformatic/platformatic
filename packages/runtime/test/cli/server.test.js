import { execa } from 'execa'
import { connect } from 'inspector-client'
import assert from 'node:assert'
import { on } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { start, startPath } from './helper.js'

test('autostart', async t => {
  const config = join(import.meta.dirname, '..', '..', 'fixtures', 'configs', 'monorepo', 'watt.config.mjs')
  const { child, url } = await start(config, { applicationId: 'serviceApp', env: { PLT_USE_PLAIN_CREATE: 'true' } })
  t.after(async () => {
    child.kill('SIGKILL')
    await child.catch(() => {})
  })
  const res = await request(url)

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
})

test('handles startup errors', async t => {
  const config = join(import.meta.dirname, '..', '..', 'fixtures', 'configs', 'service-throws-on-start', 'watt.config.mjs')
  const child = execa(process.execPath, [startPath, config], {
    encoding: 'utf8',
    env: { PLT_USE_PLAIN_CREATE: 'true' }
  })
  let stdout = ''
  let found = false

  for await (const messages of on(child.stdout, 'data')) {
    for (const message of messages) {
      stdout += message

      if (/boom/.test(stdout)) {
        found = true
        break
      }
    }

    if (found) {
      break
    }
  }

  assert(found)

  child.kill('SIGKILL')

  // if we do not await this, the test will crash because the event loop has nothing to do
  // but there is still a promise waiting
  await child.catch(() => {})
})

test('does not start if node inspector flags are provided', async t => {
  const config = join(import.meta.dirname, '..', '..', 'fixtures', 'configs', 'monorepo', 'watt.config.mjs')
  const child = execa(process.execPath, [startPath, config], {
    env: { NODE_OPTIONS: '--inspect', PLT_USE_PLAIN_CREATE: 'true' },
    encoding: 'utf8'
  })
  let stderr = ''
  let found = false

  for await (const messages of on(child.stderr, 'data')) {
    for (const message of messages) {
      stderr += message

      if (/The Node.js inspector flags are not supported/.test(stderr)) {
        found = true
        break
      }
    }

    if (found) {
      break
    }
  }

  assert(found)

  child.kill('SIGKILL')

  // if we do not await this, the test will crash because the event loop has nothing to do
  // but there is still a promise waiting
  await child.catch(() => {})
})

test('does start if node inspector flag is provided by VS Code', async t => {
  const config = join(import.meta.dirname, '..', '..', 'fixtures', 'configs', 'monorepo', 'watt.config.mjs')
  const child = execa(process.execPath, [startPath, config], {
    env: { NODE_OPTIONS: '--inspect', VSCODE_INSPECTOR_OPTIONS: '{ port: 3042 }', PLT_USE_PLAIN_CREATE: 'true' },
    encoding: 'utf8'
  })
  let stdout = ''
  let found = false

  for await (const messages of on(child.stdout, 'data')) {
    for (const message of messages) {
      stdout += message

      if (/Started the worker 0 of the application/.test(stdout)) {
        found = true
      }
    }

    if (found) {
      break
    }
  }

  assert(found)

  child.kill('SIGKILL')

  // if we do not await this, the test will crash because the event loop has nothing to do
  // but there is still a promise waiting
  await child.catch(() => {})
})

test('starts the inspector', async t => {
  const config = join(import.meta.dirname, '..', '..', 'fixtures', 'configs', 'monorepo', 'watt.config.mjs')
  const child = execa(process.execPath, [startPath, config, '--inspect'], {
    encoding: 'utf8',
    env: { PLT_USE_PLAIN_CREATE: 'true' }
  })
  let stderr = ''
  let found = false

  const startPromise = new Promise(resolve => {
    function listener (line) {
      if (line.toString().match(/Platformatic is now listening/)) {
        child.stdout.off('data', listener)
        resolve()
      }
    }

    child.stdout.on('data', listener)
  })

  const pattern = /Debugger listening on ws:\/\/127\.0\.0\.1:(\d+)/g
  const ports = new Set([9230, 9231, 9232, 9233])
  for await (const messages of on(child.stderr, 'data')) {
    for (const message of messages) {
      stderr += message

      const matches = stderr.matchAll(pattern)
      for (const match of matches) {
        ports.delete(Number(match[1]))
      }

      if (ports.size === 0) {
        found = true
        break
      }
    }

    if (found) {
      break
    }
  }

  await startPromise

  assert(found)

  /*
    One inspector port per application worker, in the order the ports were assigned. The identity
    check is the thread id, read relative to the first rather than pinned to 1: the v4 loader
    evaluates each configuration file in a worker of its own before any application starts, and
    thread ids are process-global and never reused, so the first application worker is not thread 1
    and how many threads precede it is an implementation detail of the loader.
  */
  const threadIds = []

  for (let i = 0; i < 4; i++) {
    const [data] = await (await fetch(`http://127.0.0.1:${9230 + i}/json/list`)).json()
    const { webSocketDebuggerUrl } = data

    const client = await connect(webSocketDebuggerUrl)

    const res = await client.post('Runtime.evaluate', {
      expression: "require('worker_threads').threadId",
      includeCommandLineAPI: true,
      generatePreview: true,
      returnByValue: true,
      awaitPromise: true
    })

    threadIds.push(res.result.value)

    await client.close()
  }

  assert.deepStrictEqual(
    threadIds,
    [0, 1, 2, 3].map(offset => threadIds[0] + offset),
    'each port belongs to the next application worker'
  )

  child.kill('SIGKILL')

  // if we do not await this, the test will crash because the event loop has nothing to do
  // but there is still a promise waiting
  await child.catch(() => {})
})

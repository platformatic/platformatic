import { connect } from 'inspector-client'
import assert from 'node:assert'
import { on } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { start, startPath } from './helper.mjs'

test('autostart', async () => {
  const config = join(import.meta.dirname, '..', '..', 'fixtures', 'configs', 'monorepo.json')
  const { child, url } = await start(config, { env: { PLT_USE_PLAIN_CREATE: 'true' } })
  const res = await request(url)

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
  child.kill('SIGKILL')
})

test('handles startup errors', async t => {
  const { execa } = await import('execa')
  const config = join(import.meta.dirname, '..', '..', 'fixtures', 'configs', 'service-throws-on-start.json')
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
  const { execa } = await import('execa')
  const config = join(import.meta.dirname, '..', '..', 'fixtures', 'configs', 'monorepo.json')
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
  const { execa } = await import('execa')
  const config = join(import.meta.dirname, '..', '..', 'fixtures', 'configs', 'monorepo.json')
  const child = execa(process.execPath, [startPath, config], {
    env: { NODE_OPTIONS: '--inspect', VSCODE_INSPECTOR_OPTIONS: '{ port: 3042 }', PLT_USE_PLAIN_CREATE: 'true' },
    encoding: 'utf8'
  })
  let stdout = ''
  let found = false

  for await (const messages of on(child.stdout, 'data')) {
    for (const message of messages) {
      stdout += message

      if (/Started the service/.test(stdout)) {
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
  const { execa } = await import('execa')
  const config = join(import.meta.dirname, '..', '..', 'fixtures', 'configs', 'monorepo.json')
  const child = execa(process.execPath, [startPath, config, '--inspect'], {
    encoding: 'utf8',
    env: { PLT_USE_PLAIN_CREATE: 'true' }
  })
  let stderr = ''
  let port = 0
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

  for await (const messages of on(child.stderr, 'data')) {
    for (const message of messages) {
      stderr += message

      if (new RegExp(`Debugger listening on ws://127\\.0\\.0\\.1:${9230 + port}`).test(stderr)) {
        port++
        if (port === 4) {
          found = true
          break
        }
      }
    }

    if (found) {
      break
    }
  }

  await startPromise

  assert(found)

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

    assert.strictEqual(res.result.value, i + 1)

    await client.close()
  }

  child.kill('SIGKILL')

  // if we do not await this, the test will crash because the event loop has nothing to do
  // but there is still a promise waiting
  await child.catch(() => {})
})

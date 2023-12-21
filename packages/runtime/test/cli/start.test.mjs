import assert from 'node:assert'
import { on, once } from 'node:events'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import { join } from 'desm'
import { request } from 'undici'
import { cliPath, start } from './helper.mjs'

test('autostart', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'configs', 'monorepo.json')
  const { child, url } = await start('-c', config)
  const res = await request(url)

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
  child.kill('SIGINT')
  await child.catch(() => {})
})

test('start command', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'configs', 'monorepo.json')
  const { child, url } = await start('-c', config)
  const res = await request(url)

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
  child.kill('SIGINT')
  await child.catch(() => {})
})

test('handles startup errors', async (t) => {
  const { execa } = await import('execa')
  const config = join(import.meta.url, '..', '..', 'fixtures', 'configs', 'service-throws-on-start.json')
  const child = execa(process.execPath, [cliPath, 'start', '-c', config], { encoding: 'utf8' })
  let stdout = ''
  let found = false

  for await (const messages of on(child.stdout, 'data')) {
    for (const message of messages) {
      stdout += message

      if (/Error: boom/.test(stdout)) {
        found = true
        break
      }
    }

    if (found) {
      break
    }
  }

  assert(found)

  // if we do not await this, the test will crash because the event loop has nothing to do
  // but there is still a promise waiting
  await child.catch(() => {})
})

test('exits on error', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'configs', 'monorepo.json')
  const { child, url } = await start('-c', config)
  const res = await request(url + '/crash')
  const [exitCode] = await once(child, 'exit')

  assert.strictEqual(res.statusCode, 200)
  assert.strictEqual(exitCode, 1)
})

test('does not start if node inspector flags are provided', async (t) => {
  const { execa } = await import('execa')
  const config = join(import.meta.url, '..', '..', 'fixtures', 'configs', 'monorepo.json')
  const child = execa(process.execPath, [cliPath, 'start', '-c', config], {
    env: { NODE_OPTIONS: '--inspect' },
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

  await child.catch(() => {})
})

test('starts the inspector', async (t) => {
  const { execa } = await import('execa')
  const config = join(import.meta.url, '..', '..', 'fixtures', 'configs', 'monorepo.json')
  const child = execa(process.execPath, [cliPath, 'start', '-c', config, '--inspect'], {
    encoding: 'utf8'
  })
  let stderr = ''
  let found = false

  for await (const messages of on(child.stderr, 'data')) {
    for (const message of messages) {
      stderr += message

      if (/Debugger listening on ws:\/\/127\.0\.0\.1:9229/.test(stderr)) {
        found = true
        break
      }
    }

    if (found) {
      break
    }
  }

  assert(found)
  child.kill('SIGINT')
  await child.catch(() => {})
})

test('stackable', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'stackables', 'platformatic.json')
  const { child, url } = await start('-c', config)
  const res = await request(url + '/foo')

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.text(), 'Hello World')
  child.kill('SIGINT')
  await child.catch(() => {})
})

test('use runtime server', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'server', 'runtime-server', 'platformatic.runtime.json')
  const { child, url } = await start('-c', config)
  assert.strictEqual(url, 'http://127.0.0.1:14242')
  child.kill('SIGINT')
  await child.catch(() => {})
})

test('the runtime server overrides the entrypoint server', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'server', 'overrides-service', 'platformatic.runtime.json')
  const { child, url } = await start('-c', config)
  assert.strictEqual(url, 'http://127.0.0.1:14242')
  child.kill('SIGINT')
})

test('start command with js file', async (t) => {
  const file = join(import.meta.url, '..', '..', 'fixtures', 'empty', 'hello.js')
  const config = join(import.meta.url, '..', '..', 'fixtures', 'empty', 'platformatic.service.json')
  try {
    await fs.unlink(config)
  } catch {}

  t.after(async () => {
    await fs.unlink(config)
  })

  const { child, url } = await start(file)
  const res = await request(url + '/hello')

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
  child.kill('SIGINT')
  await child.catch(() => {})
})

test('handles uncaughtException', async (t) => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'dbApp', 'platformatic.db.json')
  const { child, url } = await start('-c', config)

  t.after(async () => {
    child.kill('SIGINT')
  })
  const res = await request(url + '/async_crash')

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.text(), 'ok')

  const [code] = await once(child, 'exit')
  assert.strictEqual(code, 1)
})

import assert from 'node:assert'
import { on, once } from 'node:events'
import { test } from 'node:test'
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
})

test('start command', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'configs', 'monorepo.json')
  const { child, url } = await start('start', '-c', config)
  const res = await request(url)

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(await res.body.json(), { hello: 'hello123' })
  child.kill('SIGINT')
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
})

test('exits on error', async () => {
  const config = join(import.meta.url, '..', '..', 'fixtures', 'configs', 'monorepo.json')
  const { child, url } = await start('start', '-c', config)
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

      if (/Error: The Node.js inspector flags are not supported/.test(stderr)) {
        found = true
        break
      }
    }

    if (found) {
      break
    }
  }

  assert(found)
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
})

import assert from 'node:assert'
import { on } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { startPath } from '../helper.mjs'

test('does not start if node inspector flags are provided', async t => {
  const { execa } = await import('execa')
  const config = join(import.meta.dirname, '..', '..', '..', 'fixtures', 'configs', 'monorepo.json')
  const child = execa(process.execPath, [startPath, config], {
    env: { NODE_OPTIONS: '--inspect', env: { PLT_USE_PLAIN_CREATE: 'true' } },
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

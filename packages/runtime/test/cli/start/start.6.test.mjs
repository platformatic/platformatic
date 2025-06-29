import { join } from 'desm'
import assert from 'node:assert'
import { on } from 'node:events'
import { test } from 'node:test'
import { startPath } from '../helper.mjs'

test('does not start if node inspector flags are provided', async t => {
  const { execa } = await import('execa')
  const config = join(import.meta.url, '..', '..', '..', 'fixtures', 'configs', 'monorepo.json')
  const child = execa(process.execPath, [startPath, '-c', config], {
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

  child.kill('SIGKILL')

  // if we do not await this, the test will crash because the event loop has nothing to do
  // but there is still a promise waiting
  await child.catch(() => {})
})

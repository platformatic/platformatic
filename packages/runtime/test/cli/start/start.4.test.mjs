import assert from 'node:assert'
import { on } from 'node:events'
import { test } from 'node:test'
import { join } from 'desm'
import { cliPath } from '../helper.mjs'

test('handles startup errors', async (t) => {
  const { execa } = await import('execa')
  const config = join(import.meta.url, '..', '..', '..', 'fixtures', 'configs', 'service-throws-on-start.json')
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

import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'desm'
import { cliPath } from './helper.mjs'
import { on } from 'node:events'

test('require open telemetry for nodejs services', async () => {
  const { execa } = await import('execa')
  const config = join(import.meta.url, '..', '..', 'fixtures', 'configs', 'monorepo-with-node-telemetry.json')
  const child = execa(process.execPath, [cliPath, 'start', '-c', config], { encoding: 'utf8' })
  let found = false

  for await (const messages of on(child.stdout, 'data')) {
    for (const message of messages) {
      if (message.toString().includes('Setting up Node.js Open Telemetry')) {
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

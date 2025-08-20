import { execa } from 'execa'
import assert from 'node:assert'
import { on } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { startPath } from './helper.mjs'

// TODO@mcollina: This test cannot properly see logs as our monkey patching has issues. Please reafactor later
test('require open telemetry for nodejs applications', { skip: true }, async () => {
  const config = join(import.meta.dirname, '..', '..', 'fixtures', 'configs', 'monorepo-with-node-telemetry.json')
  const child = execa(process.execPath, [startPath, config], {
    encoding: 'utf8',
    env: { PLT_USE_PLAIN_CREATE: 'true' }
  })
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

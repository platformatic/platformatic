import assert from 'node:assert'
import { on } from 'node:events'
import { test } from 'node:test'
import { join } from 'desm'
import { cliPath } from '../helper.mjs'

test('starts the inspector', async (t) => {
  const { execa } = await import('execa')
  const config = join(import.meta.url, '..', '..', '..', 'fixtures', 'configs', 'monorepo.json')
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
  child.kill('SIGKILL')
  await child.catch(() => {})
})

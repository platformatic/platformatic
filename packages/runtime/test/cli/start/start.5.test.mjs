import assert from 'node:assert'
import { on } from 'node:events'
import { join } from 'node:path'
import { test } from 'node:test'
import { startPath } from '../helper.mjs'

test('do not start if there are no services', async t => {
  const { execa } = await import('execa')
  const config = join(
    import.meta.dirname,
    '..',
    '..',
    '..',
    'fixtures',
    'configs',
    'no-services-no-entrypoint.config.json'
  )
  const child = execa(process.execPath, [startPath, config], {
    encoding: 'utf8',
    env: { PLT_USE_PLAIN_CREATE: 'true' }
  })
  let stdout = ''
  let found = false

  child.stderr.setEncoding('utf8')
  for await (const messages of on(child.stderr, 'data')) {
    for (const message of messages) {
      stdout += message

      if (/Missing application entrypoint/.test(stdout)) {
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

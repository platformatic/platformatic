import { readFile, unlink } from 'fs/promises'
import { strictEqual } from 'node:assert'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { transform } from '../../lib/config.js'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')
const temporaryDirectory = tmpdir()

test('supports logging using a transport', async t => {
  const configFile = join(fixturesDir, 'server', 'logger-transport', 'platformatic.runtime.json')
  const dest = join(temporaryDirectory, `logger-transport-${process.pid}.log`)

  t.after(async function () {
    await unlink(dest)
    await app.close()
  })

  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.logger.transport.options = { path: dest }
      return config
    }
  })

  await app.start()

  // Wait for logs to be written
  await sleep(3000)

  const written = await readFile(dest, 'utf8')

  for (const line of written.trim().split('\n')) {
    const parsed = JSON.parse(line)

    strictEqual(parsed.fromTransport, true)
  }
})

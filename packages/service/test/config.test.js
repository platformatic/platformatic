import fs from 'fs/promises'
import assert from 'node:assert'
import os from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { LOGS_TIMEOUT, sleep } from '../../basic/test/helper.js'
import { createFromConfig } from './helper.js'

// How long the transport thread is given to appear, as opposed to how often it is asked.
const TRANSPORT_TIMEOUT = 30_000

test('config is adjusted to handle custom loggers', async t => {
  const options = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      loggerInstance: {
        level: 'trace',
        info () {},
        error () {},
        debug () {},
        fatal () {},
        warn () {},
        trace () {},
        child () {
          return options.loggerInstance
        }
      }
    }
  }

  const app = await createFromConfig(t, options)
  assert.strictEqual(app.logger, options.server.loggerInstance)
})

test('does not listen without server.port', async t => {
  const app = await createFromConfig(t, {
    watch: false,
    server: {
      logger: {
        level: 'fatal'
      }
    }
  })
  t.after(async () => {
    await app.stop()
  })

  const url = await app.start({ listen: true })
  assert.strictEqual(url, undefined)
  assert.strictEqual(app.getUrl(), undefined)

  const res = await app.inject({ method: 'GET', url: '/' })
  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(JSON.parse(res.body), {
    message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev'
  })
})

test('transport logger', async t => {
  const file = join(os.tmpdir(), `${process.pid}-4.json`)
  const options = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'info',
        transport: {
          target: join(import.meta.dirname, 'fixtures', 'custom-transport.js'),
          options: {
            path: file
          }
        }
      }
    }
  }

  const server = await createFromConfig(t, options)
  await server.start({ listen: true })
  await server.stop()

  /*
    The write happens in a custom transport, which is a worker thread: the file appears once that
    thread has started, written and flushed. A single sleep is a guess at how long that takes, and a
    slow runner loses the race -- this failed on Windows with ENOENT on the very file it is waiting
    for. Polling waits exactly as long as it has to.
  */
  let written

  for (const deadline = Date.now() + TRANSPORT_TIMEOUT; !written && Date.now() < deadline;) {
    written = await fs.readFile(file, 'utf8').catch(() => undefined)

    if (!written) {
      await sleep(LOGS_TIMEOUT)
    }
  }

  const parsed = JSON.parse(written)

  assert.strictEqual(parsed.fromTransport, true)
})

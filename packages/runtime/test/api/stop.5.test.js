import { ok } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should stop accepting new request immediately under high load', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer-no-log.json')
  const app = await createRuntime(configFile)

  t.after(() => {
    app.close()
  })

  const url = await app.start()
  let active = true
  const errors = []

  async function performRequests () {
    // eslint-disable-next-line no-unmodified-loop-condition
    while (active) {
      try {
        const { statusCode, body } = await request(url + '/service-app/', {})

        if (statusCode !== 200) {
          errors.push((await body.json()).message)
        }
      } catch (e) {
        errors.push(e.message)
      }
    }
  }

  for (let i = 0; i < 50; i++) {
    performRequests()
  }

  // After 5 seconds, stop the runtime
  await sleep(5000)
  await app.stop()
  active = false

  ok(!errors.some(m => m.match(/No target found for serviceapp.plt.local in thread \d./)))
  ok(!errors.includes('The target worker thread has exited before sending a response.'))
})

'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { setTimeout: sleep } = require('node:timers/promises')
const { request } = require('undici')

const { create } = require('../../index.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('should stop accepting new request immediately under high load', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer-no-log.json')
  const app = await create(configFile)

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

  assert.ok(!errors.some(m => m.match(/No target found for serviceapp.plt.local in thread \d./)))
  assert.ok(!errors.includes('The target worker thread has exited before sending a response.'))
})

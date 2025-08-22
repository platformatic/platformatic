
import { readFileSync } from 'node:fs'
import assert from 'node:assert'
import { test } from 'node:test'
import { hostname } from 'node:os'
import { randomUUID } from 'node:crypto'
import { request } from 'undici'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
import { setTimeout as sleep } from 'node:timers/promises'
import { setUpEnvironment, startICC } from './helper.js'
import { start } from '../index.js'
const platformaticVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

test('should spawn a service app sending the state', async (t) => {
  const applicationName = 'test-app'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'service-1')

  const applicationStates = []

  const icc = await startICC(t, {
    applicationId,
    applicationName,
    saveApplicationInstanceState: (state) => {
      applicationStates.push(state)
    }
  })

  process.env.PLT_TEST_APP_1_URL = 'http://test-app-1:3042'
  t.after(() => {
    delete process.env.PLT_TEST_APP_1_URL
  })

  setUpEnvironment({
    PLT_APP_NAME: applicationName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000'
  })

  const app = await start()

  t.after(async () => {
    await app.close()
    await icc.close()
  })

  {
    const { statusCode, body } = await request('http://127.0.0.1:3042/example')
    assert.strictEqual(statusCode, 200)

    const data = await body.json()
    assert.deepStrictEqual(data, { hello: 'world' })
  }

  {
    const { statusCode, body } = await request('http://127.0.0.1:3042/env')
    assert.strictEqual(statusCode, 200)

    const data = await body.json()
    assert.deepStrictEqual(data, {
      env: {
        ...process.env,
        PLT_DEV: 'true', // in test its' in dev mode
        PLT_ENVIRONMENT: 'development'
      }
    })
  }

  assert.strictEqual(applicationStates.length, 1)
  const [state] = applicationStates
  assert.strictEqual(state.instanceId, hostname())
  assert.deepStrictEqual(state.state.services.length, 1)
  assert.strictEqual(
    state.state.metadata.platformaticVersion, platformaticVersion
  )
})

test('should not fail on worker error', async (t) => {
  const applicationName = 'test-app'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'service-3')

  const icc = await startICC(t, {
    applicationId
  })

  setUpEnvironment({
    PLT_APP_NAME: applicationName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000'
  })

  const app = await start()

  t.after(async () => {
    await app.close()
    await icc.close()
  })

  {
    const { statusCode, body } = await request('http://127.0.0.1:3042/example')
    assert.strictEqual(statusCode, 200)

    const data = await body.json()
    assert.deepStrictEqual(data, { hello: 'world' })
  }

  // Await for runtime to crash and restart
  await sleep(4000)

  {
    const { statusCode, body } = await request('http://127.0.0.1:3042/example')
    assert.strictEqual(statusCode, 200)

    const data = await body.json()
    assert.deepStrictEqual(data, { hello: 'world' })
  }
})

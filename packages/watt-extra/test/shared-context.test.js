import assert from 'node:assert'
import { test } from 'node:test'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import {
  startICC,
  installDeps,
  setUpEnvironment,
  createJwtToken
} from './helper.js'
import { start } from '../index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

test('should propagete a jwt token via runtime shared context', async (t) => {
  const applicationName = 'test-app'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'runtime-domains')

  await installDeps(t, applicationPath, ['@platformatic/composer'])

  const expiresIn = 10
  const jwt = createJwtToken(expiresIn)

  setUpEnvironment({
    PLT_APP_NAME: applicationName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000',
    PLT_TEST_TOKEN: jwt,
    PLT_JWT_EXPIRATION_OFFSET_SEC: 1
  })

  const icc = await startICC(t, {
    applicationId,
    applicationName
  })

  const app = await start()

  let newToken = null
  setTimeout(() => {
    newToken = createJwtToken(expiresIn)
    process.env.PLT_TEST_TOKEN = newToken
  }, expiresIn * 1000)

  t.after(async () => {
    await app.close()
    await icc.close()
  })

  {
    const { statusCode, body } = await request('http://127.0.0.1:3042/1/shared-context')
    assert.strictEqual(statusCode, 200)

    const sharedContext = await body.json()

    const { iccAuthHeaders } = sharedContext
    const { authorization } = iccAuthHeaders
    assert.strictEqual(authorization, `Bearer ${jwt}`)
  }

  // Wait for the token to expire
  await sleep(expiresIn * 1000 + 1000)

  {
    const { statusCode, body } = await request('http://127.0.0.1:3042/1/shared-context')
    assert.strictEqual(statusCode, 200)

    const sharedContext = await body.json()

    const { iccAuthHeaders } = sharedContext
    const { authorization } = iccAuthHeaders
    assert.strictEqual(authorization, `Bearer ${newToken}`)
  }

  assert.notStrictEqual(jwt, newToken)
})

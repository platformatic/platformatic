
import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

import buildApp from '../app.js'
import pino from 'pino'
import {
  setUpEnvironment
} from './helper.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Create a null logger for tests
const logger = pino({
  level: 'silent'
})

// Helper to close resources after each test
const closeResources = async (app) => {
  if (app && typeof app.close === 'function') {
    try {
      await app.close()
    } catch (err) {}
  }
}

test('should retry sending info to ICC with exponential backoff', async (t) => {
  const applicationName = 'test-app'
  const applicationPath = join(__dirname, 'fixtures', 'service-1')
  const retryInterval = 50 // Small interval for test

  setUpEnvironment({
    PLT_APP_NAME: applicationName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000',
    PLT_ICC_RETRY_TIME: retryInterval
  })

  const app = await buildApp(logger)
  t.after(async () => closeResources(app))

  // Mock failure for the first 2 calls, then succeed
  let callCount = 0
  const retryTimes = []
  let lastCallTime = Date.now()

  app.sendToICC = () => {
    const now = Date.now()
    if (callCount > 0) {
      // Calculate actual delay between calls
      retryTimes.push(now - lastCallTime)
    }
    lastCallTime = now

    callCount++
    if (callCount <= 2) {
      throw new Error('Mock ICC connection failure')
    }
    return true
  }

  await app.sendToICCWithRetry()
  assert.strictEqual(callCount, 3, 'ICC should be called 3 times (1 initial + 2 retries)')
  assert.ok(retryTimes[0] >= retryInterval, 'First retry should wait at least the base retry interval')
  assert.ok(retryTimes[1] > retryTimes[0], 'Second retry should have longer delay due to exponential backoff')
})

test('should continue retrying until success within max attempts', async (t) => {
  const applicationName = 'test-app'
  const applicationPath = join(__dirname, 'fixtures', 'service-1')
  const retryInterval = 10 // Very small interval for fast test

  setUpEnvironment({
    PLT_APP_NAME: applicationName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000',
    PLT_ICC_RETRY_TIME: retryInterval
  })

  const app = await buildApp(logger)
  t.after(async () => closeResources(app))
  let callCount = 0
  const succeedAfter = 5 // Succeed after 5 attempts

  const retryTimes = []
  let lastCallTime = Date.now()

  app.sendToICC = () => {
    const now = Date.now()
    if (callCount > 0) {
      retryTimes.push(now - lastCallTime)
    }
    lastCallTime = now

    callCount++
    if (callCount <= succeedAfter) {
      throw new Error(`Mock ICC connection failure (attempt ${callCount})`)
    }
    return true
  }

  await app.sendToICCWithRetry()
  assert.strictEqual(callCount, succeedAfter + 1, `ICC should be called ${succeedAfter + 1} times (1 initial + ${succeedAfter} retries)`)

  for (let i = 1; i < retryTimes.length; i++) {
    assert.ok(
      retryTimes[i] > retryTimes[i - 1],
      `Retry interval should increase: ${retryTimes[i]} > ${retryTimes[i - 1]}`
    )
  }
})

test('should not retry if first attempt succeeds', async (t) => {
  const applicationName = 'test-app'
  const applicationPath = join(__dirname, 'fixtures', 'service-1')
  const retryInterval = 100 // Small interval for test

  setUpEnvironment({
    PLT_APP_NAME: applicationName,
    PLT_APP_DIR: applicationPath,
    PLT_ICC_URL: 'http://127.0.0.1:3000',
    PLT_ICC_RETRY_TIME: retryInterval
  })

  const app = await buildApp(logger)
  t.after(async () => closeResources(app))

  let callCount = 0
  app.sendToICC = () => {
    callCount++
    return true
  }

  await app.sendToICCWithRetry()
  assert.strictEqual(callCount, 1, 'ICC should be called only once')
})

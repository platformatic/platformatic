
import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import {
  startICC,
  installDeps,
  setUpEnvironment
} from './helper.js'
import { start } from '../index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

test('should spawn an app with auto caching', async (t) => {
  const applicationName = 'test-app'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'runtime-domains')

  await installDeps(t, applicationPath, ['@platformatic/composer'])

  const savedRequestHashes = []
  const savedRequests = []

  const cacheConfig = {
    rules: [{
      routeToMatch: 'http://alpha.plt.local/counter',
      headers: {
        'cache-control': 'public, max-age=3',
        'x-foo-bar': 'baz'
      },
      cacheTags: {
        // eslint-disable-next-line
        fgh: `'default', 'custom-cache-tag-' + .querystring["app-id"]`
      }
    }]
  }

  const iccConfig = {
    httpCacheConfig: cacheConfig
  }
  const icc = await startICC(t, {
    applicationId,
    applicationName,
    iccConfig,
    enableSlicerInterceptor: true,
    enableTrafficanteInterceptor: true,
    saveRequestHash: (data) => { savedRequestHashes.push(data) },
    saveRequest: (data) => { savedRequests.push(data) }
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
    const { statusCode, headers, body } = await request('http://127.0.0.1:3042/1/counter', {
      query: { 'app-id': '123' }
    })
    assert.strictEqual(statusCode, 200)

    const { counter } = await body.json()
    assert.strictEqual(counter, 0)

    assert.strictEqual(headers['cache-control'], 'public, max-age=3')
    assert.strictEqual(headers['x-foo-bar'], 'baz')
    assert.strictEqual(headers['x-custom-cache-tags'], 'default,custom-cache-tag-123')

    assert.strictEqual(savedRequestHashes.length, 0)
    assert.strictEqual(savedRequests.length, 0)
  }

  {
    const { statusCode, headers, body } = await request('http://127.0.0.1:3042/1/counter', {
      query: { 'app-id': '123' }
    })
    assert.strictEqual(statusCode, 200)

    const { counter } = await body.json()
    assert.strictEqual(counter, 0)

    assert.strictEqual(headers['cache-control'], 'public, max-age=3')
    assert.strictEqual(headers['x-foo-bar'], 'baz')
    assert.strictEqual(headers['x-custom-cache-tags'], 'default,custom-cache-tag-123')

    assert.strictEqual(savedRequestHashes.length, 0)
    assert.strictEqual(savedRequests.length, 0)
  }

  // Wait for the cache to expire
  await sleep(3500)

  {
    const { statusCode, headers, body } = await request('http://127.0.0.1:3042/1/counter', {
      query: { 'app-id': '123' }
    })
    assert.strictEqual(statusCode, 200)

    const { counter } = await body.json()
    assert.strictEqual(counter, 1)

    assert.strictEqual(headers['cache-control'], 'public, max-age=3')
    assert.strictEqual(headers['x-foo-bar'], 'baz')
    assert.strictEqual(headers['x-custom-cache-tags'], 'default,custom-cache-tag-123')

    assert.strictEqual(savedRequestHashes.length, 0)
    assert.strictEqual(savedRequests.length, 0)
  }

  {
    const { statusCode, headers } = await request('http://127.0.0.1:3042/2/beta')
    assert.strictEqual(statusCode, 200)

    assert.strictEqual(headers['cache-control'], undefined)
    assert.strictEqual(headers['x-foo-bar'], undefined)
    assert.strictEqual(headers['x-custom-cache-tags'], undefined)

    // Wait for interceptor to send data to the Trafficante
    await sleep(1000)

    assert.strictEqual(savedRequestHashes.length, 1)
    assert.strictEqual(savedRequests.length, 1)

    const savedRequestHash = savedRequestHashes[0]
    assert.strictEqual(savedRequestHash.applicationId, applicationId)
    assert.strictEqual(typeof savedRequestHash.timestamp, 'number')
    assert.strictEqual(savedRequestHash.request.url, 'http://beta.plt.local/beta')

    const savedRequest = savedRequests[0]
    assert.strictEqual(savedRequest.applicationId, applicationId)
    assert.strictEqual(savedRequest.request.url, 'http://beta.plt.local/beta')
    assert.ok(savedRequest.request.headers)
    assert.ok(savedRequest.response.headers)
    assert.deepStrictEqual(savedRequest.response.body, { from: 'beta' })
  }
})

test('should update the cache config at runtime', async (t) => {
  const applicationName = 'test-app'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'runtime-domains')

  await installDeps(t, applicationPath, ['@platformatic/composer'])

  const savedRequestHashes = []
  const savedRequests = []

  const initialIccConfig = {
    httpCacheConfig: {
      rules: [{
        routeToMatch: 'http://alpha.plt.local/counter',
        headers: { 'x-foo-bar': 'baz' }
      }]
    }
  }

  const icc = await startICC(t, {
    applicationId,
    applicationName,
    iccConfig: initialIccConfig,
    enableSlicerInterceptor: true,
    saveRequestHash: (data) => { savedRequestHashes.push(data) },
    saveRequest: (data) => { savedRequests.push(data) }
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
    const { statusCode, headers } = await request('http://127.0.0.1:3042/1/counter')
    assert.strictEqual(statusCode, 200)
    assert.strictEqual(headers['x-foo-bar'], 'baz')
  }

  const updatedIccConfig = {
    httpCacheConfig: {
      rules: [{
        routeToMatch: 'http://alpha.plt.local/counter',
        headers: { 'x-foo-bar': 'updated-baz' }
      }]
    }
  }

  await icc.emitApplicationUpdate(applicationId, {
    topic: 'config',
    type: 'config-updated',
    data: updatedIccConfig
  })

  {
    const { statusCode, headers } = await request('http://127.0.0.1:3042/1/counter')
    assert.strictEqual(statusCode, 200)
    assert.strictEqual(headers['x-foo-bar'], 'updated-baz')
  }
})

test('should set the cache config at runtime', async (t) => {
  const applicationName = 'test-app'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'runtime-domains')

  await installDeps(t, applicationPath, ['@platformatic/composer'])

  const savedRequestHashes = []
  const savedRequests = []

  const initialIccConfig = {
    httpCacheConfig: null
  }

  const icc = await startICC(t, {
    applicationId,
    applicationName,
    iccConfig: initialIccConfig,
    enableSlicerInterceptor: true,
    saveRequestHash: (data) => { savedRequestHashes.push(data) },
    saveRequest: (data) => { savedRequests.push(data) }
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
    const { statusCode, headers } = await request('http://127.0.0.1:3042/1/counter')
    assert.strictEqual(statusCode, 200)
    assert.strictEqual(headers['x-foo-bar'], undefined)
  }

  const updatedIccConfig = {
    httpCacheConfig: {
      rules: [{
        routeToMatch: 'http://alpha.plt.local/counter',
        headers: { 'x-foo-bar': 'updated-baz' }
      }]
    }
  }

  await icc.emitApplicationUpdate(applicationId, {
    topic: 'config',
    type: 'config-updated',
    data: updatedIccConfig
  })

  {
    const { statusCode, headers } = await request('http://127.0.0.1:3042/1/counter')
    assert.strictEqual(statusCode, 200)
    assert.strictEqual(headers['x-foo-bar'], 'updated-baz')
  }
})

test('should not set auto cache if it is disabled', async (t) => {
  const applicationName = 'test-app'
  const applicationId = randomUUID()
  const applicationPath = join(__dirname, 'fixtures', 'runtime-domains')

  await installDeps(t, applicationPath, ['@platformatic/composer'])

  const savedRequestHashes = []
  const savedRequests = []

  const cacheConfig = {
    rules: [{
      routeToMatch: 'http://alpha.plt.local/counter',
      headers: {
        'cache-control': 'public, max-age=3',
        'x-foo-bar': 'baz'
      },
      cacheTags: {
        // eslint-disable-next-line
        fgh: `'default', 'custom-cache-tag-' + .querystring["app-id"]`
      }
    }]
  }

  const iccConfig = {
    httpCacheConfig: cacheConfig
  }
  const icc = await startICC(t, {
    applicationId,
    applicationName,
    iccConfig,
    enableSlicerInterceptor: false,
    enableTrafficanteInterceptor: false,
    saveRequestHash: (data) => { savedRequestHashes.push(data) },
    saveRequest: (data) => { savedRequests.push(data) }
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
    const { statusCode, headers, body } = await request('http://127.0.0.1:3042/1/counter', {
      query: { 'app-id': '123' }
    })
    assert.strictEqual(statusCode, 200)

    const { counter } = await body.json()
    assert.strictEqual(counter, 0)

    assert.strictEqual(headers['cache-control'], undefined)
    assert.strictEqual(headers['x-foo-bar'], undefined)
    assert.strictEqual(headers['x-custom-cache-tags'], undefined)

    assert.strictEqual(savedRequestHashes.length, 0)
    assert.strictEqual(savedRequests.length, 0)
  }

  {
    const { statusCode, headers, body } = await request('http://127.0.0.1:3042/1/counter', {
      query: { 'app-id': '123' }
    })
    assert.strictEqual(statusCode, 200)

    const { counter } = await body.json()
    assert.strictEqual(counter, 1)

    assert.strictEqual(headers['cache-control'], undefined)
    assert.strictEqual(headers['x-foo-bar'], undefined)
    assert.strictEqual(headers['x-custom-cache-tags'], undefined)

    assert.strictEqual(savedRequestHashes.length, 0)
    assert.strictEqual(savedRequests.length, 0)
  }

  // Wait for the cache to expire
  await sleep(3500)

  {
    const { statusCode, headers, body } = await request('http://127.0.0.1:3042/1/counter', {
      query: { 'app-id': '123' }
    })
    assert.strictEqual(statusCode, 200)

    const { counter } = await body.json()
    assert.strictEqual(counter, 2)

    assert.strictEqual(headers['cache-control'], undefined)
    assert.strictEqual(headers['x-foo-bar'], undefined)
    assert.strictEqual(headers['x-custom-cache-tags'], undefined)

    assert.strictEqual(savedRequestHashes.length, 0)
    assert.strictEqual(savedRequests.length, 0)
  }

  {
    const { statusCode, headers } = await request('http://127.0.0.1:3042/2/beta')
    assert.strictEqual(statusCode, 200)

    assert.strictEqual(headers['cache-control'], undefined)
    assert.strictEqual(headers['x-foo-bar'], undefined)
    assert.strictEqual(headers['x-custom-cache-tags'], undefined)

    await sleep(1000)

    assert.strictEqual(savedRequestHashes.length, 0)
    assert.strictEqual(savedRequests.length, 0)
  }
})

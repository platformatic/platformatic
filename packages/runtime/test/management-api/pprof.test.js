'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should start profiling via management API', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await Promise.all([client.close(), app.close()])
  })

  // Start profiling on service-1
  const { statusCode, body } = await client.request({
    method: 'POST',
    path: '/api/v1/services/service-1/pprof/start',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ intervalMicros: 1000 })
  })

  assert.strictEqual(statusCode, 200)

  const response = await body.json()
  // The response might be empty or contain a status message
  assert.ok(typeof response === 'object' || response === null)
})

test('should stop profiling and return profile data via management API', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await Promise.all([client.close(), app.close()])
  })

  // Start profiling first
  await client.request({
    method: 'POST',
    path: '/api/v1/services/service-1/pprof/start',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ intervalMicros: 1000 })
  })

  // Wait a bit for some profile data
  await new Promise(resolve => setTimeout(resolve, 100))

  // Stop profiling and get profile data
  const { statusCode, body, headers } = await client.request({
    method: 'POST',
    path: '/api/v1/services/service-1/pprof/stop'
  })

  assert.strictEqual(statusCode, 200)

  // Should return binary profile data
  assert.strictEqual(headers['content-type'], 'application/octet-stream')

  const profileData = await body.arrayBuffer()
  assert.ok(profileData.byteLength > 0, 'Profile data should not be empty')
})

test('should handle service not found error when starting profiling', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await Promise.all([client.close(), app.close()])
  })

  // Try to start profiling on non-existent service
  const { body } = await client.request({
    method: 'POST',
    path: '/api/v1/services/non-existent/pprof/start',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ intervalMicros: 1000 })
  })

  const response = await body.json()
  assert.ok(response.code === 'PLT_RUNTIME_SERVICE_NOT_FOUND')
})

test('should handle service not found error when stopping profiling', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await Promise.all([client.close(), app.close()])
  })

  // Try to stop profiling on non-existent service
  const { body } = await client.request({
    method: 'POST',
    path: '/api/v1/services/non-existent/pprof/stop'
  })

  const response = await body.json()
  assert.ok(response.code === 'PLT_RUNTIME_SERVICE_NOT_FOUND')
})

test('should handle profiling already started error', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await Promise.all([client.close(), app.close()])
  })

  // Start profiling
  await client.request({
    method: 'POST',
    path: '/api/v1/services/service-1/pprof/start',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ intervalMicros: 1000 })
  })

  // Try to start profiling again
  const { body } = await client.request({
    method: 'POST',
    path: '/api/v1/services/service-1/pprof/start',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({ intervalMicros: 1000 })
  })

  const response = await body.json()
  assert.ok(response.code === 'PLT_PPROF_PROFILING_ALREADY_STARTED')

  // Clean up - stop profiling
  await client.request({
    method: 'POST',
    path: '/api/v1/services/service-1/pprof/stop'
  })
})

test('should handle profiling not started error', async t => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  const client = new Client(
    {
      hostname: 'localhost',
      protocol: 'http:'
    },
    {
      socketPath: app.getManagementApiUrl(),
      keepAliveTimeout: 10,
      keepAliveMaxTimeout: 10
    }
  )

  t.after(async () => {
    await Promise.all([client.close(), app.close()])
  })

  // Try to stop profiling when it's not started
  const { body } = await client.request({
    method: 'POST',
    path: '/api/v1/services/service-1/pprof/stop'
  })

  const response = await body.json()
  assert.ok(response.code === 'PLT_PPROF_PROFILING_NOT_STARTED')
})

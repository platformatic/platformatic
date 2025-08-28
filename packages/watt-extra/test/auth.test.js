import { test } from 'node:test'
import { equal } from 'node:assert'
import fastify from 'fastify'
import { request } from 'undici'
import { setUpEnvironment, createJwtToken } from './helper.js'
import authPlugin from '../plugins/auth.js'

const createMockApp = () => {
  return {
    log: {
      info: () => {},
      warn: () => {},
      error: () => {}
    }
  }
}

test('auth plugin sets authorization header with token', async (t) => {
  const originalEnv = { ...process.env }

  t.after(() => {
    process.env = originalEnv
  })

  const testToken = 'test-env-token-5678'
  setUpEnvironment({ PLT_TEST_TOKEN: testToken })

  const server = fastify()
  server.get('/', async (request) => {
    return { headers: request.headers }
  })
  await server.listen({ port: 0 })
  const url = `http://localhost:${server.server.address().port}`

  t.after(() => server.close())

  const app = createMockApp()
  await authPlugin(app)

  const tokenResponse = await request(url, { dispatcher: app.dispatcher })
  const tokenResponseBody = await tokenResponse.body.json()

  equal(tokenResponse.statusCode, 200)
  equal(tokenResponseBody.headers.authorization, `Bearer ${testToken}`)
  equal(app.token, testToken)
})

test('auth plugin falls back to env variable when k8s token is not available', async (t) => {
  const originalEnv = { ...process.env }

  t.after(() => {
    process.env = originalEnv
  })

  const testToken = 'test-env-token-5678'
  setUpEnvironment({ PLT_TEST_TOKEN: testToken })

  const server = fastify()
  server.get('/', async (request) => {
    return { headers: request.headers }
  })
  await server.listen({ port: 0 })
  const url = `http://localhost:${server.server.address().port}`

  t.after(() => server.close())

  const app = createMockApp()
  await authPlugin(app)

  equal(app.token, testToken)

  const tokenResponse = await request(url, { dispatcher: app.dispatcher })
  const tokenResponseBody = await tokenResponse.body.json()

  equal(tokenResponse.statusCode, 200)
  equal(tokenResponseBody.headers.authorization, `Bearer ${testToken}`)
})

test('auth plugin reloads expired token', async (t) => {
  const originalEnv = { ...process.env }

  t.after(() => {
    process.env = originalEnv
  })

  const expiredToken = createJwtToken(-10) // Already expired (by 10 seconds)
  const validToken = createJwtToken(3600) // Valid for 1 hour

  process.env.PLT_TEST_TOKEN = expiredToken

  const logMessages = []
  const app = {
    log: {
      info: (msg) => {
        if (typeof msg === 'string') {
          logMessages.push(msg)
        }
      },
      warn: () => {},
      error: () => {}
    }
  }

  // Set up test server
  const server = fastify()
  server.get('/', async (request) => {
    return { headers: request.headers }
  })
  await server.listen({ port: 0 })
  const url = `http://localhost:${server.server.address().port}`

  t.after(async () => server.close())

  await authPlugin(app)

  // The initial token is the expired one
  equal(app.token, expiredToken, 'Should initially load the expired token')

  // Now change the environment variable for the next token load
  process.env.PLT_TEST_TOKEN = validToken

  const response = await request(url, { dispatcher: app.dispatcher })
  const responseBody = await response.body.json()
  equal(app.token, validToken, 'Token should be reloaded with valid token')
  equal(responseBody.headers.authorization, `Bearer ${validToken}`, 'Valid token should be used in authorization header')
  const reloadLogMessage = logMessages.find(msg => msg === 'JWT token expired, reloading')
  equal(!!reloadLogMessage, true, 'Should log message about token reload')
})

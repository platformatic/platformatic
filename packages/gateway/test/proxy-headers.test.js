import assert from 'assert/strict'
import { test } from 'node:test'
import { request } from 'undici'
import { createApplication, createFromConfig } from './helper.js'

async function startEcho (t) {
  const application = await createApplication(t, [
    {
      method: 'GET',
      path: '/echo',
      handler: async (req, reply) => {
        reply.header('x-powered-by', 'upstream')
        reply.header('x-frame-options', 'DENY')
        return { headers: req.headers }
      }
    }
  ])

  return application.listen({ port: 0 })
}

async function startGateway (t, origin, proxy) {
  const gateway = await createFromConfig(t, {
    server: { logger: { level: 'fatal' } },
    gateway: { applications: [{ id: 'main', origin, proxy: { prefix: '/main', ...proxy } }] }
  })

  return gateway.start({ listen: true })
}

test('should set and remove request headers from proxy.headers', async t => {
  const origin = await startEcho(t)
  const gatewayOrigin = await startGateway(t, origin, {
    headers: {
      'X-Upstream-Host': 'upstream.example.com',
      'x-forwarded-host': 'public.example.com',
      cookie: null
    }
  })

  const { statusCode, body } = await request(gatewayOrigin, {
    method: 'GET',
    path: '/main/echo',
    headers: { cookie: 'session=secret', 'x-upstream-host': 'from-the-client', authorization: 'Bearer token' }
  })
  assert.equal(statusCode, 200)

  const { headers } = await body.json()
  // Set over what the client sent, by the lower-case name.
  assert.equal(headers['x-upstream-host'], 'upstream.example.com')
  // Set over what the gateway itself sets.
  assert.equal(headers['x-forwarded-host'], 'public.example.com')
  // Removed by null.
  assert.equal(headers.cookie, undefined)
  // Untouched.
  assert.equal(headers.authorization, 'Bearer token')
})

test('should set and remove response headers from proxy.responseHeaders', async t => {
  const origin = await startEcho(t)
  const gatewayOrigin = await startGateway(t, origin, {
    responseHeaders: {
      'Content-Security-Policy': "frame-ancestors 'self'",
      'x-frame-options': null
    }
  })

  const { statusCode, headers, body } = await request(gatewayOrigin, { method: 'GET', path: '/main/echo' })
  assert.equal(statusCode, 200)
  await body.dump()

  assert.equal(headers['content-security-policy'], "frame-ancestors 'self'")
  assert.equal(headers['x-frame-options'], undefined)
  assert.equal(headers['x-powered-by'], 'upstream')
})

test('should leave the headers alone without proxy.headers or proxy.responseHeaders', async t => {
  const origin = await startEcho(t)
  const gatewayOrigin = await startGateway(t, origin, {})

  const { headers, body } = await request(gatewayOrigin, {
    method: 'GET',
    path: '/main/echo',
    headers: { cookie: 'session=secret' }
  })
  const echoed = await body.json()

  assert.equal(echoed.headers.cookie, 'session=secret')
  assert.equal(headers['x-frame-options'], 'DENY')
})

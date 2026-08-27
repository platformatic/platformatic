import { deepStrictEqual, strictEqual } from 'node:assert'
import test from 'node:test'
import { platformaticHttp2HeadersPlugin } from '../lib/http2-headers-plugin.js'

test('normalizes HTTP/2 pseudo-headers without changing request metadata', () => {
  let middleware
  const plugin = platformaticHttp2HeadersPlugin()

  plugin.configureServer({
    middlewares: {
      use (handler) {
        middleware = handler
      }
    }
  })

  const req = {
    headers: {
      ':authority': 'example.test:8443',
      ':method': 'GET',
      ':path': '/',
      ':scheme': 'https',
      'x-test': 'value'
    },
    httpVersionMajor: 2,
    method: 'GET',
    url: '/'
  }
  let nextCalled = false

  middleware(req, {}, () => {
    nextCalled = true
  })

  deepStrictEqual(req.headers, {
    host: 'example.test:8443',
    'x-test': 'value'
  })
  strictEqual(req.method, 'GET')
  strictEqual(req.url, '/')
  strictEqual(nextCalled, true)
})

test('leaves HTTP/1 requests unchanged', () => {
  let middleware
  const plugin = platformaticHttp2HeadersPlugin()

  plugin.configureServer({
    middlewares: {
      use (handler) {
        middleware = handler
      }
    }
  })

  const headers = { host: 'example.test', 'x-test': 'value' }
  const req = { headers, httpVersionMajor: 1 }

  middleware(req, {}, () => {})

  strictEqual(req.headers, headers)
})

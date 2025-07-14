import { deepStrictEqual, rejects } from 'node:assert'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { cleanBasePath, ensureFileUrl, ensureTrailingSlash, getServerUrl, injectViaRequest } from '../lib/utils.js'

function defaultServerListener (_, res) {
  res.writeHead(200, {
    'content-type': 'application/json',
    connection: 'close'
  })

  res.end(JSON.stringify({ production: process.env.NODE_ENV === 'production' }))
}

async function listen (server, opts) {
  return new Promise((resolve, reject) => {
    return server.listen(opts, resolve).on('error', reject)
  })
}

function createHttpServer (t, listener) {
  const server = createServer(listener ?? defaultServerListener)
  t.after(() => server.close())

  return server
}

test('getServerUrl - should return the correct IPv4 address', async t => {
  const server = createHttpServer(t)
  await listen(server, { host: '127.0.0.1', port: 0 })

  deepStrictEqual(getServerUrl(server), `http://127.0.0.1:${server.address().port}`)
})

test('getServerUrl - should return the correct IPv6 address', async t => {
  const server = createHttpServer(t)
  await listen(server, { host: '::1', port: 0 })

  deepStrictEqual(getServerUrl(server), `http://[::1]:${server.address().port}`)
})

test('injectViaRequest - should perform a request', async t => {
  const server = createHttpServer(t)
  await listen(server, { port: 0 })
  const url = getServerUrl(server)

  const response = await injectViaRequest(url, { url: '/', method: 'POST', body: '{"ok":true}' })
  response.headers.date = 'now'

  deepStrictEqual(response.statusCode, 200)
  deepStrictEqual(response.headers, {
    'content-type': 'application/json',
    'transfer-encoding': 'chunked',
    connection: 'close',
    date: 'now'
  })
  deepStrictEqual(response.body, '{"production":false}')
  deepStrictEqual(response.payload, '{"production":false}')
  deepStrictEqual(response.rawPayload, Buffer.from('{"production":false}'))
})

test('injectViaRequest - should perform a request (onInject)', async t => {
  const server = createHttpServer(t)
  await listen(server, { port: 0 })
  const url = getServerUrl(server)

  const { resolve, promise } = Promise.withResolvers()

  await injectViaRequest(url, { url: '/', method: 'POST', body: { ok: true } }, (_, response) => resolve(response))
  const response = await promise
  response.headers.date = 'now'

  deepStrictEqual(response.statusCode, 200)
  deepStrictEqual(response.headers, {
    'content-type': 'application/json',
    'transfer-encoding': 'chunked',
    connection: 'close',
    date: 'now'
  })
  deepStrictEqual(response.body, '{"production":false}')
  deepStrictEqual(response.payload, '{"production":false}')
  deepStrictEqual(response.rawPayload, Buffer.from('{"production":false}'))
})

test('injectViaRequest - should handle errors', async t => {
  await rejects(() => injectViaRequest('INVALID', {}), /Invalid URL/)
})

test('injectViaRequest - should perform a request (onInject)', async t => {
  const { reject, promise } = Promise.withResolvers()
  await injectViaRequest('INVALID', {}, error => reject(error))

  await rejects(promise, /Invalid URL/)
})

test('ensureFileUrl - should correctly perform conversions', async t => {
  deepStrictEqual(ensureFileUrl(null), null)
  deepStrictEqual(ensureFileUrl(123).toString(), pathToFileURL('123').toString())
  deepStrictEqual(ensureFileUrl('file://this-is\\weird').toString(), 'file://this-is\\weird')
  deepStrictEqual(ensureFileUrl('/tmp/foo/bar').toString(), pathToFileURL('/tmp/foo/bar').toString())
})

test('cleanBasePath - should correctly clean paths', async t => {
  deepStrictEqual(cleanBasePath(), '/')
  deepStrictEqual(cleanBasePath('base//path////abc/'), '/base/path/abc')
})

test('ensureTrailingSlash - should correctly append a trailing slash', async t => {
  deepStrictEqual(ensureTrailingSlash(), '/')
  deepStrictEqual(ensureTrailingSlash('base/'), 'base/')
  deepStrictEqual(ensureTrailingSlash('base'), 'base/')
})

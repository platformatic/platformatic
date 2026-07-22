import assert from 'node:assert'
import http from 'node:http'
import { after, test } from 'node:test'
import { installSkewProtection } from '../lib/worker/skew-protection.js'

// installSkewProtection subscribes once per process, so every server in this
// file shares one installation, which is also how it runs in a worker.
let currentVersion = 'v3'
installSkewProtection({
  getVersion: () => currentVersion,
  cookieName: '__plt_dpl',
  maxAge: 43200,
  basePath: null
})

const servers = []

function startServer (handler) {
  const server = http.createServer(handler)
  servers.push(server)
  return new Promise(resolve => {
    server.listen(0, () => resolve(`http://127.0.0.1:${server.address().port}`))
  })
}

after(() => {
  for (const server of servers) server.close()
})

test('a first-time visitor is pinned to this deployment version', async () => {
  const url = await startServer((req, res) => res.end('ok'))
  const response = await fetch(url)

  assert.deepStrictEqual(response.headers.getSetCookie(), [
    '__plt_dpl=v3; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=43200'
  ])
})

test('an application cookie set through writeHead is not replaced by ours', async () => {
  // Setting the header at request start loses this race: writeHead's headers
  // replace anything set earlier, so the pin would silently disappear.
  const url = await startServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain', 'set-cookie': 'session=abc' })
    res.end('ok')
  })

  const cookies = (await fetch(url)).headers.getSetCookie()
  assert.strictEqual(cookies.length, 2)
  assert.ok(cookies.includes('session=abc'))
  assert.ok(cookies.some(c => c.startsWith('__plt_dpl=v3')))
})

test('an application cookie set through setHeader is not replaced by ours', async () => {
  const url = await startServer((req, res) => {
    res.setHeader('set-cookie', 'session=abc')
    res.end('ok')
  })

  const cookies = (await fetch(url)).headers.getSetCookie()
  assert.strictEqual(cookies.length, 2)
  assert.ok(cookies.includes('session=abc'))
  assert.ok(cookies.some(c => c.startsWith('__plt_dpl=v3')))
})

test('several application cookies are all preserved alongside ours', async () => {
  const url = await startServer((req, res) => {
    res.setHeader('set-cookie', ['a=1', 'b=2'])
    res.end('ok')
  })

  const cookies = (await fetch(url)).headers.getSetCookie()
  assert.deepStrictEqual(cookies.slice(0, 2), ['a=1', 'b=2'])
  assert.ok(cookies[2].startsWith('__plt_dpl=v3'))
})

test('an already pinned visitor is left alone so a draining version can drain', async () => {
  const url = await startServer((req, res) => res.end('ok'))
  const response = await fetch(url, { headers: { cookie: '__plt_dpl=v1' } })

  assert.deepStrictEqual(response.headers.getSetCookie(), [])
})

test('a preview request is never pinned to the version it previews', async () => {
  const url = await startServer((req, res) => res.end('ok'))
  const response = await fetch(url, { headers: { 'x-deployment-id': 'v9' } })

  assert.deepStrictEqual(response.headers.getSetCookie(), [])
})

test('a redirect still carries the pin', async () => {
  const url = await startServer((req, res) => {
    res.writeHead(302, { location: '/elsewhere' })
    res.end()
  })

  const response = await fetch(url, { redirect: 'manual' })
  assert.strictEqual(response.status, 302)
  assert.ok(response.headers.getSetCookie().some(c => c.startsWith('__plt_dpl=v3')))
})

test('a streamed response still carries the pin', async () => {
  const url = await startServer((req, res) => {
    res.write('chunk one')
    res.write('chunk two')
    res.end()
  })

  const response = await fetch(url)
  assert.ok(response.headers.getSetCookie().some(c => c.startsWith('__plt_dpl=v3')))
  assert.strictEqual(await response.text(), 'chunk onechunk two')
})

test('nothing is pinned until a version is assigned a version', async () => {
  const url = await startServer((req, res) => res.end('ok'))

  currentVersion = null
  try {
    assert.deepStrictEqual((await fetch(url)).headers.getSetCookie(), [])
  } finally {
    currentVersion = 'v3'
  }
})

test('a version arriving after boot is picked up without a restart', async () => {
  const url = await startServer((req, res) => res.end('ok'))

  currentVersion = 'v4'
  try {
    const cookies = (await fetch(url)).headers.getSetCookie()
    assert.ok(cookies.some(c => c.startsWith('__plt_dpl=v4')))
  } finally {
    currentVersion = 'v3'
  }
})

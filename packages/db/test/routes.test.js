import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createFromConfig, getConnectionInfo } from './helper.js'

test('should respond 200 on root endpoint', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' },
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    db: {
      ...connectionInfo
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  {
    // No browser (i.e. curl)
    const res = await request(`${app.url}/`)
    assert.equal(res.statusCode, 200)
    const body = await res.body.json()
    assert.deepEqual(body, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
  }

  {
    // browser
    const res = await request(`${app.url}/`, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
      }
    })
    const html = await res.body.text()
    assert.equal(res.statusCode, 200)
    assert.equal(res.headers['content-type'], 'text/html; charset=utf-8')
    // has links to OpenAPI/GraphQL docs
    assert.ok(html.includes('<a id="openapi-link" target="_blank" class="button-link">OpenAPI Documentation</a>'))
    assert.ok(html.includes('<a id="graphql-link" target="_blank" class="button-link">GraphiQL</a>'))
  }
})

test('should not overwrite a plugin which define a root endpoint', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' },
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    db: {
      ...connectionInfo
    },
    plugins: {
      paths: [join(import.meta.dirname, 'fixtures', 'root-endpoint-plugin.js')]
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  const res = await request(`${app.url}/`)
  assert.equal(res.statusCode, 200)
  const body = await res.body.json()
  assert.deepEqual(body, { message: 'Root Plugin' })
})

test('should exclude the root endpoint from the openapi documentation', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  const res = await request(`${app.url}/documentation/json`)
  const openapi = await res.body.json()
  assert.equal(res.statusCode, 200)
  assert.equal(openapi.paths['/'], undefined)
})

test('should not overwrite a plugin which uses @fastify/static on root', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' },
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    db: {
      ...connectionInfo
    },
    plugins: {
      paths: [join(import.meta.dirname, 'fixtures', 'root-static.js')]
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  const res = await request(`${app.url}/`)
  assert.equal(res.statusCode, 200)
  const body = await res.body.text()
  const expected = await readFile(join(import.meta.dirname, 'fixtures', 'hello', 'index.html'), 'utf8')
  assert.equal(body, expected)
})

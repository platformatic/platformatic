import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { buildConfig, createFromConfig } from './helper.js'

test('should respond 200 on root endpoint', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        healthCheck: {
          enabled: true,
          interval: 2000
        }
      }
    })
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  {
    // No browser (i.e. curl)
    const res = await request(`${app.url}/`)
    assert.strictEqual(res.statusCode, 200)
    const body = await res.body.json()
    assert.deepStrictEqual(body, { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
  }

  {
    // browser
    const res = await request(`${app.url}/`, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
      }
    })

    assert.strictEqual(res.statusCode, 200)
    assert.strictEqual(res.headers['content-type'], 'text/html; charset=utf-8')
  }
})

test('should not overwrite a plugin which define a root endpoint', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        healthCheck: {
          enabled: true,
          interval: 2000
        }
      },
      plugins: {
        paths: [join(import.meta.dirname, 'fixtures', 'root-endpoint-plugin.js')]
      }
    })
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request(`${app.url}/`)
  assert.strictEqual(res.statusCode, 200)
  const body = await res.body.json()
  assert.deepStrictEqual(body, { message: 'Root Plugin' })
})

test('openapi enabled', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        healthCheck: {
          enabled: true,
          interval: 2000
        }
      },
      service: {
        openapi: true
      },
      plugins: {
        paths: [join(import.meta.dirname, 'fixtures', 'root-endpoint-plugin.js')]
      }
    })
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  {
    // No browser (i.e. curl)
    const res = await request(`${app.url}/documentation/json`)
    assert.strictEqual(res.statusCode, 200)
    const body = await res.body.json()

    assert.strictEqual(body.openapi, '3.0.3')
    assert.strictEqual(body.info.title, 'Platformatic')
    assert.strictEqual(body.info.version, '1.0.0')
    assert.strictEqual(!!body.paths['/'].get, true)
  }
})

test('openapi config', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' }
      },
      service: {
        openapi: {
          info: {
            title: 'My Service',
            version: '0.0.42',
            description: 'My Service is the best service ever'
          }
        }
      },
      plugins: {
        paths: [join(import.meta.dirname, 'fixtures', 'root-endpoint-plugin.js')]
      }
    })
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  {
    // No browser (i.e. curl)
    const res = await request(`${app.url}/documentation/json`)
    assert.strictEqual(res.statusCode, 200)
    const body = await res.body.json()

    assert.strictEqual(body.openapi, '3.0.3')
    assert.strictEqual(body.info.title, 'My Service')
    assert.strictEqual(body.info.version, '0.0.42')
    assert.strictEqual(body.info.description, 'My Service is the best service ever')
    assert.strictEqual(!!body.paths['/'].get, true)
  }
})

test('openapi disabled', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        healthCheck: {
          enabled: true,
          interval: 2000
        }
      },
      service: {
        openapi: false
      },
      plugins: {
        paths: [join(import.meta.dirname, 'fixtures', 'root-endpoint-plugin.js')]
      }
    })
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  {
    // No browser (i.e. curl)
    const res = await request(`${app.url}/documentation/json`)
    assert.strictEqual(res.statusCode, 404)
    await res.body.text()
  }
})

test('openapi disabled by default', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        healthCheck: {
          enabled: true,
          interval: 2000
        }
      },
      plugins: {
        paths: [join(import.meta.dirname, 'fixtures', 'root-endpoint-plugin.js')]
      }
    })
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  {
    // No browser (i.e. curl)
    const res = await request(`${app.url}/documentation/json`)
    assert.strictEqual(res.statusCode, 404)
    await res.body.text()
  }
})

test('request id is a uuid', async t => {
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    plugins: {
      paths: [join(import.meta.dirname, 'fixtures', 'request-id.js')]
    }
  })

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request(`${app.url}/request-id`, {
    method: 'GET'
  })
  assert.strictEqual(res.statusCode, 200)
  const json = await res.body.json()
  assert.match(json.request_id, UUID_REGEX)
})

test('ready in plugin', async t => {
  const app = await createFromConfig(
    t,
    buildConfig({
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        healthCheck: {
          enabled: true,
          interval: 2000
        }
      },
      plugins: {
        paths: [
          {
            path: join(import.meta.dirname, 'fixtures', 'ready-directory'),
            encapsulate: false
          }
        ]
      }
    })
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })
})

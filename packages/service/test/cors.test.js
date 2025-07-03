'use strict'

const assert = require('assert')
const { test } = require('node:test')
const { request } = require('undici')
const { platformaticService } = require('..')
const { createFromConfig } = require('./helper')

test('CORS is disabled by default', async t => {
  const app = await createFromConfig(
    t,
    {
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' }
      }
    },
    async function applicationFactory (app, opts) {
      app.register(platformaticService, opts)
      app.post('/login', (req, reply) => {})
    }
  )

  // handles login
  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  const res = await request(`${app.url}/login`, {
    method: 'OPTIONS',
    headers: {
      'Access-Control-Request-Method': 'POST',
      Origin: 'https://foo.bar.org'
    }
  })
  assert.strictEqual(res.statusCode, 404)
})

test('CORS can be enabled', async t => {
  const app = await createFromConfig(
    t,
    {
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        cors: {
          origin: true,
          methods: ['GET', 'POST']
        }
      }
    },
    async function applicationFactory (app, opts) {
      app.register(platformaticService, opts)
      app.post('/login', (req, reply) => {})
    }
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://foo.bar.org'
      }
    })
    assert.strictEqual(res.statusCode, 204)
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://foo.bar.org')
    assert.strictEqual(res.headers['access-control-allow-methods'], 'GET, POST')
  }
})

test('CORS with a regexp', async t => {
  const app = await createFromConfig(
    t,
    {
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        cors: {
          origin: {
            regexp: 'https://[a-z-]*.deploy.space|https://platformatic.cloud'
          },
          methods: ['GET', 'POST']
        }
      }
    },
    async function applicationFactory (app, opts) {
      app.register(platformaticService, opts)
      app.post('/login', (req, reply) => {})
    }
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://platformatic.cloud'
      }
    })
    assert.strictEqual(res.statusCode, 204)
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://platformatic.cloud')
    assert.strictEqual(res.headers['access-control-allow-methods'], 'GET, POST')
  }

  {
    const res = await request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://foo.deploy.space'
      }
    })
    assert.strictEqual(res.statusCode, 204)
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://foo.deploy.space')
    assert.strictEqual(res.headers['access-control-allow-methods'], 'GET, POST')
  }

  {
    const res = await request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://foo.space'
      }
    })
    assert.strictEqual(res.statusCode, 204)
    assert.strictEqual(res.headers['access-control-allow-origin'], undefined)
    assert.strictEqual(res.headers['access-control-allow-methods'], 'GET, POST')
  }
})

test('CORS with an array of strings', async t => {
  const app = await createFromConfig(
    t,
    {
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        cors: {
          origin: ['https://foo.deploy.space', 'https://platformatic.cloud'],
          methods: ['GET', 'POST']
        }
      }
    },
    async function applicationFactory (app, opts) {
      app.register(platformaticService, opts)
      app.post('/login', (req, reply) => {})
    }
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://platformatic.cloud'
      }
    })
    assert.strictEqual(res.statusCode, 204)
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://platformatic.cloud')
    assert.strictEqual(res.headers['access-control-allow-methods'], 'GET, POST')
  }

  {
    const res = await request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://foo.deploy.space'
      }
    })
    assert.strictEqual(res.statusCode, 204)
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://foo.deploy.space')
    assert.strictEqual(res.headers['access-control-allow-methods'], 'GET, POST')
  }

  {
    const res = await request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://foo.cloud'
      }
    })
    assert.strictEqual(res.statusCode, 204)
    assert.strictEqual(res.headers['access-control-allow-origin'], undefined)
    assert.strictEqual(res.headers['access-control-allow-methods'], 'GET, POST')
  }
})

test('CORS with an array and a regexp', async t => {
  const app = await createFromConfig(
    t,
    {
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        cors: {
          origin: [
            {
              regexp: 'https://[a-z-]*.deploy.space'
            },
            'https://platformatic.cloud'
          ],
          methods: ['GET', 'POST']
        }
      }
    },
    async function applicationFactory (app, opts) {
      app.register(platformaticService, opts)
      app.post('/login', (req, reply) => {})
    }
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://platformatic.cloud'
      }
    })
    assert.strictEqual(res.statusCode, 204)
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://platformatic.cloud')
    assert.strictEqual(res.headers['access-control-allow-methods'], 'GET, POST')
  }

  {
    const res = await request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://foo.deploy.space'
      }
    })
    assert.strictEqual(res.statusCode, 204)
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://foo.deploy.space')
    assert.strictEqual(res.headers['access-control-allow-methods'], 'GET, POST')
  }

  {
    const res = await request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://foo.cloud'
      }
    })
    assert.strictEqual(res.statusCode, 204)
    assert.strictEqual(res.headers['access-control-allow-origin'], undefined)
    assert.strictEqual(res.headers['access-control-allow-methods'], 'GET, POST')
  }
})

test('CORS with a string', async t => {
  const app = await createFromConfig(
    t,
    {
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' },
        cors: {
          origin: 'https://platformatic.cloud',
          methods: ['GET', 'POST']
        }
      }
    },
    async function applicationFactory (app, opts) {
      app.register(platformaticService, opts)
      app.post('/login', (req, reply) => {})
    }
  )

  t.after(async () => {
    await app.stop()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://foo.cloud'
      }
    })
    assert.strictEqual(res.statusCode, 204)
    assert.strictEqual(res.headers['access-control-allow-origin'], 'https://platformatic.cloud')
    assert.strictEqual(res.headers['access-control-allow-methods'], 'GET, POST')
  }
})

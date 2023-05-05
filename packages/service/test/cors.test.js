'use strict'

require('./helper')
const { test } = require('tap')
const { buildServer, platformaticService } = require('..')
const { request } = require('undici')

test('CORS is disabled by default', async ({ teardown, equal, pass, same }) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    metrics: false
  }, async function (app, opts) {
    app.register(platformaticService, opts)
    app.post('/login', (req, reply) => {})
  })

  // handles login
  teardown(async () => {
    await app.close()
  })
  await app.start()

  const res = await (request(`${app.url}/login`, {
    method: 'OPTIONS',
    headers: {
      'Access-Control-Request-Method': 'POST',
      Origin: 'https://foo.bar.org'
    }
  }))
  equal(res.statusCode, 404)
})

test('CORS can be enabled', async ({ teardown, equal, pass, same }) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      cors: {
        origin: true,
        methods: ['GET', 'POST']
      }
    },
    metrics: false
  }, async function (app, opts) {
    app.register(platformaticService, opts)
    app.post('/login', (req, reply) => {})
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await (request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://foo.bar.org'
      }
    }))
    equal(res.statusCode, 204)
    equal(res.headers['access-control-allow-origin'], 'https://foo.bar.org')
    equal(res.headers['access-control-allow-methods'], 'GET, POST')
  }
})

test('CORS with a regexp', async ({ teardown, equal, pass, same }) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      cors: {
        origin: {
          regexp: 'https://[a-z-]*.deploy.space|https://platformatic.cloud'
        },
        methods: ['GET', 'POST']
      }
    },
    metrics: false
  }, async function (app, opts) {
    app.register(platformaticService, opts)
    app.post('/login', (req, reply) => {})
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await (request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://platformatic.cloud'
      }
    }))
    equal(res.statusCode, 204)
    equal(res.headers['access-control-allow-origin'], 'https://platformatic.cloud')
    equal(res.headers['access-control-allow-methods'], 'GET, POST')
  }

  {
    const res = await (request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://foo.deploy.space'
      }
    }))
    equal(res.statusCode, 204)
    equal(res.headers['access-control-allow-origin'], 'https://foo.deploy.space')
    equal(res.headers['access-control-allow-methods'], 'GET, POST')
  }

  {
    const res = await (request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://foo.space'
      }
    }))
    equal(res.statusCode, 204)
    equal(res.headers['access-control-allow-origin'], undefined)
    equal(res.headers['access-control-allow-methods'], 'GET, POST')
  }
})

test('CORS with an array of strings', async ({ teardown, equal, pass, same }) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      cors: {
        origin: ['https://foo.deploy.space', 'https://platformatic.cloud'],
        methods: ['GET', 'POST']
      }
    },
    metrics: false
  }, async function (app, opts) {
    app.register(platformaticService, opts)
    app.post('/login', (req, reply) => {})
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await (request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://platformatic.cloud'
      }
    }))
    equal(res.statusCode, 204)
    equal(res.headers['access-control-allow-origin'], 'https://platformatic.cloud')
    equal(res.headers['access-control-allow-methods'], 'GET, POST')
  }

  {
    const res = await (request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://foo.deploy.space'
      }
    }))
    equal(res.statusCode, 204)
    equal(res.headers['access-control-allow-origin'], 'https://foo.deploy.space')
    equal(res.headers['access-control-allow-methods'], 'GET, POST')
  }

  {
    const res = await (request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://foo.cloud'
      }
    }))
    equal(res.statusCode, 204)
    equal(res.headers['access-control-allow-origin'], undefined)
    equal(res.headers['access-control-allow-methods'], 'GET, POST')
  }
})

test('CORS with an array and a regexp', async ({ teardown, equal, pass, same }) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      cors: {
        origin: [{
          regexp: 'https://[a-z-]*.deploy.space'
        }, 'https://platformatic.cloud'],
        methods: ['GET', 'POST']
      }
    },
    metrics: false
  }, async function (app, opts) {
    app.register(platformaticService, opts)
    app.post('/login', (req, reply) => {})
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await (request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://platformatic.cloud'
      }
    }))
    equal(res.statusCode, 204)
    equal(res.headers['access-control-allow-origin'], 'https://platformatic.cloud')
    equal(res.headers['access-control-allow-methods'], 'GET, POST')
  }

  {
    const res = await (request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://foo.deploy.space'
      }
    }))
    equal(res.statusCode, 204)
    equal(res.headers['access-control-allow-origin'], 'https://foo.deploy.space')
    equal(res.headers['access-control-allow-methods'], 'GET, POST')
  }

  {
    const res = await (request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://foo.cloud'
      }
    }))
    equal(res.statusCode, 204)
    equal(res.headers['access-control-allow-origin'], undefined)
    equal(res.headers['access-control-allow-methods'], 'GET, POST')
  }
})

test('CORS with a string', async ({ teardown, equal, pass, same }) => {
  const app = await buildServer({
    server: {
      hostname: '127.0.0.1',
      port: 0,
      cors: {
        origin: 'https://platformatic.cloud',
        methods: ['GET', 'POST']
      }
    },
    metrics: false
  }, async function (app, opts) {
    app.register(platformaticService, opts)
    app.post('/login', (req, reply) => {})
  })

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await (request(`${app.url}/_admin/login`, {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        Origin: 'https://foo.cloud'
      }
    }))
    equal(res.statusCode, 204)
    equal(res.headers['access-control-allow-origin'], 'https://platformatic.cloud')
    equal(res.headers['access-control-allow-methods'], 'GET, POST')
  }
})

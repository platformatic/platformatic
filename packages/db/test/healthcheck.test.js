'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { request } = require('undici')
const { buildServer } = require('..')
const { buildConfigManager, getConnectionInfo } = require('./helper')

test('healthcheck route enabled with interval', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000
      }
    },
    db: {
      ...connectionInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  }

  const configManager = await buildConfigManager(config)
  const app = await buildServer({ configManager })

  t.after(async () => {
    await app.close()
    await dropTestDB()
  })
  await app.start()

  {
    const res = await (request(`${app.url}/status`))
    assert.equal(res.statusCode, 200)
    const body = await res.body.json()
    assert.deepEqual(body, { status: 'ok' })
  }

  {
    await app.platformatic.db.dispose()
    const res = await (request(`${app.url}/status`))
    assert.equal(res.statusCode, 503)
    const body = await res.body.json()
    assert.deepEqual(body, {
      statusCode: 503,
      code: 'FST_UNDER_PRESSURE',
      error: 'Service Unavailable',
      message: 'Service Unavailable'
    })
  }
})

test('healthcheck route enabled without interval', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: true
    },
    db: {
      ...connectionInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  }

  const configManager = await buildConfigManager(config)
  const app = await buildServer({ configManager })

  t.after(async () => {
    await app.close()
    await dropTestDB()
  })
  await app.start()

  {
    const res = await (request(`${app.url}/status`))
    assert.equal(res.statusCode, 200)
    const body = await res.body.json()
    assert.deepEqual(body, { status: 'ok' })
  }

  {
    await app.platformatic.db.dispose()
    const res = await (request(`${app.url}/status`))
    assert.equal(res.statusCode, 503)
    const body = await res.body.json()
    assert.deepEqual(body, {
      statusCode: 503,
      code: 'FST_UNDER_PRESSURE',
      error: 'Service Unavailable',
      message: 'Service Unavailable'
    })
  }
})

test('healthcheck route disabled', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      ...connectionInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  }

  const configManager = await buildConfigManager(config)
  const app = await buildServer({ configManager })

  t.after(async () => {
    await app.close()
    await dropTestDB()
  })
  await app.start()

  const res = await (request(`${app.url}/status`))
  assert.equal(res.statusCode, 404)
})

test('healthcheck route enabled with interval and maxEventLoopUtilization', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      healthCheck: {
        enabled: true,
        interval: 2000,
        maxEventLoopUtilization: 0.98
      }
    },
    db: {
      ...connectionInfo
    },
    authorization: {
      adminSecret: 'secret'
    }
  }

  const configManager = await buildConfigManager(config)
  const app = await buildServer({ configManager })

  t.after(async () => {
    await app.close()
    await dropTestDB()
  })
  await app.start()

  {
    const res = await (request(`${app.url}/status`))
    assert.equal(res.statusCode, 200)
    const body = await res.body.json()
    assert.deepEqual(body, { status: 'ok' })
  }

  {
    await app.platformatic.db.dispose()
    const res = await (request(`${app.url}/status`))
    assert.equal(res.statusCode, 503)
    const body = await res.body.json()
    assert.deepEqual(body, {
      statusCode: 503,
      code: 'FST_UNDER_PRESSURE',
      error: 'Service Unavailable',
      message: 'Service Unavailable'
    })
  }
})

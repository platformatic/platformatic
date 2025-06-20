'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { request } = require('undici')
const { createStackableFromConfig, getConnectionInfo } = require('./helper')

test('healthcheck route enabled with interval', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createStackableFromConfig(t, {
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
    authorization: {
      adminSecret: 'secret'
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/status`)
    assert.equal(res.statusCode, 200)
    const body = await res.body.json()
    assert.deepEqual(body, { status: 'ok' })
  }

  {
    await app.getApplication().platformatic.db.dispose()
    const res = await request(`${app.url}/status`)
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

test('healthcheck route enabled without interval', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' },
      healthCheck: true
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

  {
    const res = await request(`${app.url}/status`)
    assert.equal(res.statusCode, 200)
    const body = await res.body.json()
    assert.deepEqual(body, { status: 'ok' })
  }

  {
    await app.getApplication().platformatic.db.dispose()
    const res = await request(`${app.url}/status`)
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

test('healthcheck route disabled', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createStackableFromConfig(t, {
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

  const res = await request(`${app.url}/status`)
  assert.equal(res.statusCode, 404)
})

test('healthcheck route enabled with interval and maxEventLoopUtilization', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' },
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
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  {
    const res = await request(`${app.url}/status`)
    assert.equal(res.statusCode, 200)
    const body = await res.body.json()
    assert.deepEqual(body, { status: 'ok' })
  }

  {
    await app.getApplication().platformatic.db.dispose()
    const res = await request(`${app.url}/status`)
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

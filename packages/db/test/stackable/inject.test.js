'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { createFromConfig, getConnectionInfo } = require('../helper')

test('inject request into service stackable', async t => {
  const workingDir = join(__dirname, '..', 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const stackable = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo
    },
    plugins: {
      paths: [join(workingDir, 'routes')]
    },
    watch: false,
    metrics: false
  })

  t.after(async () => {
    await stackable.stop()
    await dropTestDB()
  })
  await stackable.start({ listen: true })

  {
    const { statusCode, body } = await stackable.inject('/')
    assert.strictEqual(statusCode, 200, 'status code')

    const data = JSON.parse(body)
    assert.deepStrictEqual(data, { hello: 'from root' })
  }

  {
    const { statusCode, body } = await stackable.inject('/foo/bar')
    assert.strictEqual(statusCode, 200, 'status code')

    const data = JSON.parse(body)
    assert.deepStrictEqual(data, { hello: 'from bar' })
  }

  {
    const { statusCode, body } = await stackable.inject('/foo/baz')
    assert.strictEqual(statusCode, 200, 'status code')

    const data = JSON.parse(body)
    assert.deepStrictEqual(data, { hello: 'from baz' })
  }
})

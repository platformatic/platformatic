'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { buildConfigManager, getConnectionInfo } = require('../helper')
const { buildStackable } = require('../..')

test('inject request into service stackable', async (t) => {
  const workingDir = join(__dirname, '..', 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
    },
    db: {
      ...connectionInfo,
    },
    plugins: {
      paths: [join(workingDir, 'routes')],
    },
    watch: false,
    metrics: false,
  }

  const configManager = await buildConfigManager(config, workingDir)
  const stackable = await buildStackable({ configManager })

  t.after(async () => {
    await stackable.stop()
    await dropTestDB()
  })
  await stackable.start()

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

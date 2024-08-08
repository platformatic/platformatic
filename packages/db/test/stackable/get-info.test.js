'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { buildConfigManager, getConnectionInfo } = require('../helper')
const { buildStackable } = require('../..')

const pltVersion = require('../../package.json').version

test('get service info via stackable api', async (t) => {
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
  const { stackable } = await buildStackable({ configManager })

  t.after(async () => {
    await stackable.stop()
    await dropTestDB()
  })
  await stackable.start()

  const stackableInfo = await stackable.getInfo()
  assert.deepStrictEqual(stackableInfo, {
    type: 'db',
    version: pltVersion,
  })
})

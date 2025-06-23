'use strict'

const { access, cp } = require('node:fs/promises')
const { test } = require('node:test')
const { join } = require('node:path')
const assert = require('node:assert')
const { createStackable } = require('../..')
const { createTemporaryDirectory } = require('../helper')

test('compile typescript', async t => {
  const testDir = join(__dirname, '..', 'fixtures', 'typescript-plugin')
  const cwd = await createTemporaryDirectory(t)
  await cp(testDir, cwd, { recursive: true })

  const service = await createStackable(join(cwd, 'platformatic.service.no-logging.json'))
  await service.build()

  const jsPluginPath = join(cwd, 'dist', 'plugin.js')
  try {
    await access(jsPluginPath)
  } catch (err) {
    assert.fail(err)
  }
})

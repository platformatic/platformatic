'use strict'

const { access, cp } = require('node:fs/promises')
const { test } = require('node:test')
const { join } = require('node:path')
const assert = require('node:assert')
const { create } = require('../..')
const { createTemporaryDirectory } = require('../../../basic/test/helper')

test('compile typescript', async t => {
  const testDir = join(__dirname, '..', 'fixtures', 'typescript-plugin')
  const cwd = await createTemporaryDirectory(t)
  await cp(testDir, cwd, { recursive: true })

  const service = await create(join(cwd, 'platformatic.service.no-logging.json'))
  await service.build()

  const jsPluginPath = join(cwd, 'dist', 'plugin.js')
  try {
    await access(jsPluginPath)
  } catch (err) {
    assert.fail(err)
  }
})

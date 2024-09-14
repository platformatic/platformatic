'use strict'

const { createDirectory, safeRemove } = require('@platformatic/utils')
const { access, cp } = require('node:fs/promises')
const { test } = require('node:test')
const { join } = require('node:path')
const assert = require('node:assert')
const { buildStackable } = require('../..')

let count = 0

async function getCWD (t) {
  const dir = join(__dirname, '..', 'tmp', `typescript-plugin-clone-1-${count++}`)

  await createDirectory(dir, true)

  t.after(() => safeRemove(dir))

  return dir
}

test('compile typescript', async (t) => {
  const testDir = join(__dirname, '..', 'fixtures', 'typescript-plugin')
  const cwd = await getCWD(t)
  await cp(testDir, cwd, { recursive: true })

  const stackable = await buildStackable({
    config: join(cwd, 'platformatic.service.json'),
  })

  await stackable.build()

  const jsPluginPath = join(cwd, 'dist', 'plugin.js')
  try {
    await access(jsPluginPath)
  } catch (err) {
    assert.fail(err)
  }
})

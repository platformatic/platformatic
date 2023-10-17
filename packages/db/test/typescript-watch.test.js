'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { rm } = require('node:fs/promises')
const { buildServer } = require('..')

test('ignore watch dist/**/*', async (t) => {
  const targetDir = join(__dirname, 'fixtures', 'typescript-plugin')
  const app = await buildServer(join(targetDir, 'platformatic.db.json'))

  try {
    await rm(join(targetDir, 'dist'), { recursive: true })
  } catch {}

  t.after(async () => {
    await app.close()
  })

  assert.deepEqual(app.platformatic.configManager.current.watch, {
    enabled: false,
    ignore: ['dist/**/*']
  })
})

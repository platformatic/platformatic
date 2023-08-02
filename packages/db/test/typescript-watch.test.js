'use strict'

const { test } = require('tap')
const { join } = require('path')
const { rm } = require('fs/promises')

test('ignore watch dist/**/*', async ({ teardown, same }) => {
  const { buildServer } = require('..')
  const targetDir = join(__dirname, 'fixtures', 'typescript-plugin')
  const app = await buildServer(join(targetDir, 'platformatic.db.json'))

  try {
    await rm(join(targetDir, 'dist'), { recursive: true })
  } catch {}

  teardown(async () => {
    await app.close()
  })

  same(app.platformatic.configManager.current.watch, {
    enabled: false,
    ignore: ['dist/**/*']
  })
})

'use strict'

const { test } = require('tap')
const { computeSQLiteIgnores, isFileAccessible, urlDirname, getJSPluginPath } = require('../lib/utils')
const os = require('os')
const { basename, join } = require('path')
const isWindows = os.platform() === 'win32'

test('compute SQLite ignores (Windows)', { skip: !isWindows }, ({ same, equal, plan }) => {
  plan(3)
  {
    const dirOfConfig = 'C:\\Users\\matteo\\platformatic'
    const sqliteFullPath = 'C:\\aboslute\\path\\to\\db.sqlite'
    const result = computeSQLiteIgnores(sqliteFullPath, dirOfConfig)
    same(result, [])
  }
  {
    const dirOfConfig = 'C:\\Users\\matteo\\platformatic'
    const sqliteFullPath = 'C:\\Users\\matteo\\platformatic\\db.sqlite'
    const result = computeSQLiteIgnores(sqliteFullPath, dirOfConfig)
    same(result, ['db.sqlite', 'db.sqlite-journal'])
  }
  {
    const dirOfConfig = 'C:\\Users\\matteo\\platformatic'
    const sqliteFullPath = 'C:\\Users\\matteo\\platformatic\\subdir\\db.sqlite'
    const result = computeSQLiteIgnores(sqliteFullPath, dirOfConfig)
    same(result, ['subdir\\db.sqlite', 'subdir\\db.sqlite-journal'])
  }
})

test('urlDirname', ({ same, plan }) => {
  plan(1)
  let filePath
  if (isWindows) {
    filePath = 'file://C:\\Users\\matteo\\path\\to\\file.json'
    same(urlDirname(filePath), 'C:\\Users\\matteo\\path\\to')
  } else {
    filePath = 'file:///path/to/file.json'
    same(urlDirname(filePath), '/path/to')
  }
})

test('isFileAccessible', async ({ same, plan }) => {
  plan(4)
  {
    // single filename
    const file = basename(__filename)
    same(await isFileAccessible(file, __dirname), true)
    same(await isFileAccessible('impossible.file', __dirname), false)
  }

  {
    // full path
    const file = __filename
    same(await isFileAccessible(file), true)
    same(await isFileAccessible('/impossible/path/impossible.file'), false)
  }
})

test('should get the path of a JS plugin', (t) => {
  t.plan(1)

  const result = getJSPluginPath('plugin.ts', 'dist')
  const expected = join(process.cwd(), 'dist', 'plugin.js')
  t.equal(result, expected)
})

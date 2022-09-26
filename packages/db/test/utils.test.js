'use strict'

const { test } = require('tap')
const { computeSQLiteIgnores, urlDirname } = require('../lib/utils')
const os = require('os')
const isWindows = os.platform() === 'win32'

test('compute SQLite ignores (Unix)', { skip: isWindows }, ({ same, equal, plan }) => {
  plan(3)
  {
    const dirOfConfig = '/config'
    const sqliteFullPath = '/aboslute/path/to/db.sqlite'
    const result = computeSQLiteIgnores(sqliteFullPath, dirOfConfig)
    same(result, [])
  }
  {
    const dirOfConfig = '/config'
    const sqliteFullPath = '/config/db.sqlite'
    const result = computeSQLiteIgnores(sqliteFullPath, dirOfConfig)
    same(result, ['db.sqlite', 'db.sqlite-journal'])
  }
  {
    const dirOfConfig = '/config'
    const sqliteFullPath = '/config/subdir/db.sqlite'
    const result = computeSQLiteIgnores(sqliteFullPath, dirOfConfig)
    same(result, ['subdir/db.sqlite', 'subdir/db.sqlite-journal'])
  }
})

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
  const str = 'file:///path/to/file.json'
  same(urlDirname(str), '/path/to')
})

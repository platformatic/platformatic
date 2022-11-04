'use strict'

const { test } = require('tap')
const { isFileAccessible, urlDirname } = require('../lib/utils')
const os = require('os')
const { basename } = require('path')
const isWindows = os.platform() === 'win32'

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

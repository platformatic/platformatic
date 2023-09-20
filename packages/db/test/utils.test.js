'use strict'

const { test } = require('tap')
const { urlDirname } = require('../lib/utils')
const os = require('os')
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

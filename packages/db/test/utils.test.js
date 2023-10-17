'use strict'

const assert = require('node:assert/strict')
const os = require('node:os')
const { test } = require('node:test')
const { urlDirname } = require('../lib/utils')

const isWindows = os.platform() === 'win32'

test('urlDirname', (t) => {
  let filePath
  if (isWindows) {
    filePath = 'file://C:\\Users\\matteo\\path\\to\\file.json'
    assert.equal(urlDirname(filePath), 'C:\\Users\\matteo\\path\\to')
  } else {
    filePath = 'file:///path/to/file.json'
    assert.equal(urlDirname(filePath), '/path/to')
  }
})

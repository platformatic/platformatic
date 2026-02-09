import assert from 'node:assert/strict'
import os from 'node:os'
import { test } from 'node:test'
import { urlDirname } from '../lib/utils.js'

const isWindows = os.platform() === 'win32'

test('urlDirname', t => {
  let filePath
  if (isWindows) {
    filePath = 'file://C:\\Users\\matteo\\path\\to\\file.json'
    assert.equal(urlDirname(filePath), 'C:\\Users\\matteo\\path\\to')
  } else {
    filePath = 'file:///path/to/file.json'
    assert.equal(urlDirname(filePath), '/path/to')
  }
})
